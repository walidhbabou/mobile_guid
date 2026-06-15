import { HomePage } from '../pages/home.page';
import { PlaceDetailPage } from '../pages/place-detail.page';

const homePage = new HomePage();
const detailPage = new PlaceDetailPage();

describe('04 — Gestion des favoris', () => {
  beforeEach(() => {
    cy.interceptApiCalls();
    cy.loginByApi();
    homePage.visit();
    cy.wait('@getPlaces');
  });

  it('ajoute un lieu en favori depuis la carte principale', () => {
    cy.get('.hm-card__fav').first()
      .should('not.have.class', 'hm-card__fav--on')
      .click();

    cy.get('.hm-card__fav').first()
      .should('have.class', 'hm-card__fav--on');

    cy.get('.hm-card__fav').first()
      .find('ion-icon')
      .should('have.attr', 'name', 'heart');

    cy.screenshot('favorite-added-from-card');
  });

  it('retire un favori en re-cliquant sur le bouton cœur', () => {
    cy.get('.hm-card__fav').first().click();
    cy.get('.hm-card__fav').first().should('have.class', 'hm-card__fav--on');

    cy.get('.hm-card__fav').first().click();
    cy.get('.hm-card__fav').first().should('not.have.class', 'hm-card__fav--on');

    cy.get('.hm-card__fav').first()
      .find('ion-icon')
      .should('have.attr', 'name', 'heart-outline');

    cy.screenshot('favorite-removed-from-card');
  });

  it('ajoute un favori depuis une mini-carte', () => {
    cy.get('.hm-mini-card__fav').first()
      .should('not.have.class', 'hm-mini-card__fav--on')
      .click();

    cy.get('.hm-mini-card__fav').first()
      .should('have.class', 'hm-mini-card__fav--on');

    cy.screenshot('favorite-added-from-mini-card');
  });

  it('ajoute un favori depuis la page de détail', () => {
    cy.visit('/tabs/place/plage-bahia-agadir');
    cy.waitForIonicApp();
    cy.wait('@getPlaceDetail');

    detailPage.favoriteButton
      .should('not.have.class', 'circle-button--active');

    detailPage.toggleFavorite();

    detailPage.favoriteButton
      .should('have.class', 'circle-button--active');

    detailPage.favoriteIcon
      .should('have.attr', 'name', 'heart');

    cy.screenshot('favorite-added-from-detail');
  });

  it('retire un favori depuis la page de détail', () => {
    cy.visit('/tabs/place/plage-bahia-agadir');
    cy.waitForIonicApp();
    cy.wait('@getPlaceDetail');

    detailPage.toggleFavorite();
    detailPage.favoriteButton.should('have.class', 'circle-button--active');

    detailPage.toggleFavorite();
    detailPage.favoriteButton.should('not.have.class', 'circle-button--active');

    detailPage.favoriteIcon.should('have.attr', 'name', 'heart-outline');

    cy.screenshot('favorite-removed-from-detail');
  });

  it('navigue vers l\'onglet favoris et affiche les lieux sauvegardés', () => {
    cy.get('.hm-card__fav').first().click();

    cy.get('ion-tab-bar ion-tab-button').eq(2).click();

    cy.url().should('include', '/tabs/favorites');
    cy.screenshot('favorites-tab');
  });
});
