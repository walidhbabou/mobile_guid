import { LoginPage } from '../pages/login.page';

const loginPage = new LoginPage();

describe('01 — Authentification', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/api/auth/signin', { fixture: 'auth-response.json' }).as('signin');
    cy.intercept('GET', '**/api/auth/me', { fixture: 'user-profile.json' }).as('profile');
    cy.intercept('GET', '**/api/morocco-ai/places', { fixture: 'places.json' }).as('getPlaces');
    cy.intercept('GET', '**/api/core/categories', { body: [] }).as('categories');
    cy.intercept('GET', '**/api/core/favorites/user/**', { body: [] }).as('favorites');
    cy.intercept('GET', '**/api/core/history/user/**', { body: [] }).as('history');
    loginPage.visit();
  });

  it('affiche la page de connexion', () => {
    cy.url().should('include', '/auth/login');
    cy.get('.auth-header').should('be.visible');
    cy.contains('Bienvenue').should('be.visible');
    cy.contains('Se connecter').should('be.visible');
    cy.screenshot('login-page');
  });

  it('affiche les erreurs de validation si le formulaire est soumis vide', () => {
    loginPage.submit();

    cy.get('.field__error').should('have.length.at.least', 1);
    cy.screenshot('login-validation-errors');
  });

  it('connecte l\'utilisateur avec des identifiants valides', () => {
    loginPage.fillAndSubmit('testuser', 'Test1234!');

    cy.wait('@signin').its('request.body').should('deep.include', {
      username: 'testuser',
      password: 'Test1234!',
    });

    cy.url().should('include', '/tabs');
    cy.screenshot('login-success');
  });

  it('stocke le token JWT dans localStorage après connexion', () => {
    loginPage.fillAndSubmit('testuser', 'Test1234!');

    cy.wait('@signin');

    cy.window().its('localStorage').invoke('getItem', 'accessToken').should('not.be.null');
    cy.window().its('localStorage').invoke('getItem', 'isLoggedIn').should('eq', 'true');
  });

  it('navigue vers la page d\'inscription depuis le login', () => {
    loginPage.signupLink.click();

    cy.url().should('include', '/auth/signup');
    cy.screenshot('signup-page');
  });

  it('navigue vers la page mot de passe oublié', () => {
    loginPage.forgotPasswordLink.click();

    cy.url().should('include', '/auth/forgot-password');
    cy.screenshot('forgot-password-page');
  });
});
