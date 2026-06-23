import { HomePage } from '../pages/home.page';
import { PlaceDetailPage } from '../pages/place-detail.page';

const homePage = new HomePage();
const detailPage = new PlaceDetailPage();

describe('03 — Détail d\'un lieu', () => {
  beforeEach(() => {
    cy.interceptApiCalls();
    cy.loginByApi();
    homePage.visit();
    cy.wait('@getPlaces');
  });

  it('navigue vers la page de détail depuis l\'accueil', () => {
    homePage.search('plage agadir');
    cy.wait('@aiSearch');

    cy.get('.hm-card').first()
      .find('ion-button').first()
      .click();

    cy.url().should('include', '/tabs/place/');
    cy.screenshot('place-detail-navigation');
  });

  it('affiche le nom et la localisation du lieu', () => {
    cy.visit('/tabs/place/plage-bahia-agadir');
    cy.waitForIonicApp();
    cy.wait('@getPlaceDetail');

    detailPage.placeName.should('be.visible');
    detailPage.placeLocation.should('be.visible');
    cy.screenshot('place-detail-header');
  });

  it('affiche la note du lieu', () => {
    cy.visit('/tabs/place/plage-bahia-agadir');
    cy.waitForIonicApp();
    cy.wait('@getPlaceDetail');

    detailPage.placeRating.should('be.visible');
    cy.screenshot('place-detail-rating');
  });

  it('affiche la section carte interactive', () => {
    cy.visit('/tabs/place/plage-bahia-agadir');
    cy.waitForIonicApp();
    cy.wait('@getPlaceDetail');

    // ion-content uses a shadow-DOM scroll container — use Ionic's own API to scroll.
    cy.window().then((win) => {
      const ionContent = win.document.querySelector('ion-content') as any;
      const target = win.document.querySelector('.map-card') as HTMLElement | null;
      if (ionContent && target) {
        const inner = ionContent.shadowRoot?.querySelector('.inner-scroll');
        const scrollTop = (inner ? (inner as HTMLElement).scrollTop : 0) + target.getBoundingClientRect().top - 20;
        return ionContent.scrollToPoint(0, scrollTop, 0) as Promise<void>;
      }
    });
    cy.contains('Carte interactive').should('be.visible');
    cy.screenshot('place-detail-map');
  });

  it('affiche la section guide audio', () => {
    cy.visit('/tabs/place/plage-bahia-agadir');
    cy.waitForIonicApp();
    cy.wait('@getPlaceDetail');

    cy.window().then((win) => {
      const ionContent = win.document.querySelector('ion-content') as any;
      const target = win.document.querySelector('.audio-card') as HTMLElement | null;
      if (ionContent && target) {
        const inner = ionContent.shadowRoot?.querySelector('.inner-scroll');
        const scrollTop = (inner ? (inner as HTMLElement).scrollTop : 0) + target.getBoundingClientRect().top - 20;
        return ionContent.scrollToPoint(0, scrollTop, 0) as Promise<void>;
      }
    });
    cy.contains('Guide audio').should('be.visible');
    cy.contains('Lire audio').should('be.visible');
    cy.screenshot('place-detail-audio');
  });

  it('affiche le formulaire d\'avis', () => {
    cy.visit('/tabs/place/plage-bahia-agadir');
    cy.waitForIonicApp();
    cy.wait('@getPlaceDetail');

    cy.window().then((win) => {
      const ionContent = win.document.querySelector('ion-content') as any;
      const target = win.document.querySelector('.review-form-card') as HTMLElement | null;
      if (ionContent && target) {
        const inner = ionContent.shadowRoot?.querySelector('.inner-scroll');
        const scrollTop = (inner ? (inner as HTMLElement).scrollTop : 0) + target.getBoundingClientRect().top - 20;
        return ionContent.scrollToPoint(0, scrollTop, 0) as Promise<void>;
      }
    });
    cy.contains('Laisser un avis').should('be.visible');
    detailPage.ratingChips.should('have.length', 5);
    detailPage.reviewTextarea.should('be.visible');
    cy.screenshot('place-detail-review-form');
  });

  it('retourne à l\'accueil via le bouton retour', () => {
    cy.visit('/tabs/place/plage-bahia-agadir');
    cy.waitForIonicApp();
    cy.wait('@getPlaceDetail');

    detailPage.goBack();

    cy.url().should('not.include', '/place/');
    cy.screenshot('place-detail-back');
  });

  it('soumet un avis avec note et commentaire', () => {
    cy.intercept('POST', '**/api/auth/validate', { body: { valid: true, userId: 1 } });

    cy.visit('/tabs/place/plage-bahia-agadir');
    cy.waitForIonicApp();
    cy.wait('@getPlaceDetail');

    detailPage.selectRating(5);
    detailPage.writeReview('Endroit magnifique, je recommande vivement !');
    detailPage.submitReview();

    cy.wait('@postReview').its('request.body').should('deep.include', {
      rating: 5,
      comment: 'Endroit magnifique, je recommande vivement !',
    });

    cy.screenshot('place-detail-review-submitted');
  });
});
