import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';
import { of, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';
import { CoreDataService } from '../services/core-data.service';
import { ThemeService } from '../services/theme.service';
import { Tab5Page } from './tab5.page';

describe('Tab5Page', () => {
  let component: Tab5Page;
  let fixture: ComponentFixture<Tab5Page>;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let coreDataServiceSpy: jasmine.SpyObj<CoreDataService>;

  beforeEach(async () => {
    authServiceSpy = jasmine.createSpyObj<AuthService>('AuthService', [
      'getCurrentUserProfile',
      'updateCurrentUserProfile',
      'updateCurrentUserPassword',
      'logout',
    ]);
    coreDataServiceSpy = jasmine.createSpyObj<CoreDataService>('CoreDataService', ['getProfileOverview']);

    authServiceSpy.getCurrentUserProfile.and.returnValue(of({
      id: 1,
      username: 'yassine',
      fullName: 'Yassine Tester',
      email: 'yassine@test.com',
      phone: '0600000000',
    }));
    coreDataServiceSpy.getProfileOverview.and.returnValue(of({ stats: [], actions: [], badges: [] }));

    await TestBed.configureTestingModule({
      declarations: [Tab5Page],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: CoreDataService, useValue: coreDataServiceSpy },
        ThemeService,
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Tab5Page);
    component = fixture.componentInstance;
    fixture.detectChanges();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('passwordStrength', () => {
    it('should return 0 for an empty password', () => {
      component.passwordForm.newPassword = '';
      expect(component.passwordStrength).toBe(0);
    });

    it('should return 25 for a password with 6 characters', () => {
      component.passwordForm.newPassword = 'abcdef';
      expect(component.passwordStrength).toBe(25);
    });

    it('should return 50 for a password with 10 characters', () => {
      component.passwordForm.newPassword = 'abcdefghij';
      expect(component.passwordStrength).toBe(50);
    });

    it('should return 75 for a 10-character password with an uppercase letter', () => {
      component.passwordForm.newPassword = 'Abcdefghij';
      expect(component.passwordStrength).toBe(75);
    });

    it('should return 100 for a strong password with all criteria met', () => {
      component.passwordForm.newPassword = 'Abcdefghij1';
      expect(component.passwordStrength).toBe(100);
    });
  });

  describe('passwordStrengthLabel', () => {
    it('should label 0 as Faible', () => {
      component.passwordForm.newPassword = '';
      expect(component.passwordStrengthLabel).toBe('Faible');
    });

    it('should label 100 as Fort', () => {
      component.passwordForm.newPassword = 'Abcdefghij1';
      expect(component.passwordStrengthLabel).toBe('Fort');
    });
  });

  describe('profileCompletion', () => {
    it('should return 0 for an empty profile form', () => {
      component.profileForm = { fullName: '', email: '', phone: '' };
      expect(component.profileCompletion).toBe(0);
    });

    it('should return 40 when only fullName is filled', () => {
      component.profileForm = { fullName: 'Yassine', email: '', phone: '' };
      expect(component.profileCompletion).toBe(40);
    });

    it('should return 80 when fullName and email are filled', () => {
      component.profileForm = { fullName: 'Yassine', email: 'y@test.com', phone: '' };
      expect(component.profileCompletion).toBe(80);
    });

    it('should return 100 when all fields are filled', () => {
      component.profileForm = { fullName: 'Yassine', email: 'y@test.com', phone: '0600000000' };
      expect(component.profileCompletion).toBe(100);
    });
  });

  describe('saveProfile', () => {
    it('should set an error message when fullName is empty', () => {
      component.profileForm = { fullName: '', email: 'y@test.com', phone: '' };

      component.saveProfile();

      expect(component.profileMessage).toContain('obligatoires');
      expect(component.profileMessageType).toBe('error');
      expect(authServiceSpy.updateCurrentUserProfile).not.toHaveBeenCalled();
    });

    it('should set an error message for an invalid email', () => {
      component.profileForm = { fullName: 'Yassine', email: 'not-an-email', phone: '' };

      component.saveProfile();

      expect(component.profileMessage).toContain('email valide');
      expect(component.profileMessageType).toBe('error');
    });

    it('should call updateCurrentUserProfile with valid data', () => {
      authServiceSpy.updateCurrentUserProfile.and.returnValue(of({
        id: 1, username: 'yassine', fullName: 'Yassine T', email: 'y@test.com', phone: '',
      }));
      component.profileForm = { fullName: 'Yassine T', email: 'y@test.com', phone: '' };

      component.saveProfile();

      expect(authServiceSpy.updateCurrentUserProfile).toHaveBeenCalledWith({
        fullName: 'Yassine T',
        email: 'y@test.com',
        phone: '',
      });
      expect(component.profileMessageType).toBe('success');
    });
  });

  describe('updatePassword', () => {
    it('should set an error message when any field is empty', () => {
      component.passwordForm = { currentPassword: '', newPassword: 'newpass1', confirmPassword: 'newpass1' };

      component.updatePassword();

      expect(component.passwordMessage).toContain('trois champs');
      expect(component.passwordMessageType).toBe('error');
    });

    it('should reject passwords shorter than 6 characters', () => {
      component.passwordForm = { currentPassword: 'old', newPassword: 'abc', confirmPassword: 'abc' };

      component.updatePassword();

      expect(component.passwordMessage).toContain('6 caract');
      expect(component.passwordMessageType).toBe('error');
    });

    it('should reject mismatched passwords', () => {
      component.passwordForm = { currentPassword: 'oldpass', newPassword: 'newpass1', confirmPassword: 'different' };

      component.updatePassword();

      expect(component.passwordMessage).toContain('confirmation ne correspond pas');
      expect(component.passwordMessageType).toBe('error');
    });

    it('should call updateCurrentUserPassword with valid data', () => {
      authServiceSpy.updateCurrentUserPassword.and.returnValue(of({ message: 'Mot de passe mis a jour.' }));
      component.passwordForm = { currentPassword: 'oldpass', newPassword: 'newpass1', confirmPassword: 'newpass1' };

      component.updatePassword();

      expect(authServiceSpy.updateCurrentUserPassword).toHaveBeenCalledWith({
        currentPassword: 'oldpass',
        newPassword: 'newpass1',
      });
      expect(component.passwordMessageType).toBe('success');
    });
  });

  describe('toggleProfileEdit', () => {
    it('should enter edit mode on first call', () => {
      component.toggleProfileEdit();
      expect(component.isEditingProfile).toBeTrue();
    });

    it('should exit edit mode on second call', () => {
      component.toggleProfileEdit();
      component.toggleProfileEdit();
      expect(component.isEditingProfile).toBeFalse();
    });

    it('should restore snapshot when cancelProfileEdit is called', () => {
      component.profileForm = { fullName: 'Original', email: 'o@test.com', phone: '' };
      component.toggleProfileEdit();
      component.profileForm = { fullName: 'Modified', email: 'o@test.com', phone: '' };

      component.cancelProfileEdit();

      expect(component.profileForm.fullName).toBe('Original');
      expect(component.isEditingProfile).toBeFalse();
    });
  });

  describe('logout', () => {
    it('should delegate logout to AuthService', () => {
      component.logout();
      expect(authServiceSpy.logout).toHaveBeenCalled();
    });
  });
});
