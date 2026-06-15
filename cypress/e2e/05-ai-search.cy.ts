import { HomePage } from '../pages/home.page';

const homePage = new HomePage();

describe('05 — Recherche IA avancée', () => {
  beforeEach(() => {
    cy.interceptApiCalls();
    cy.loginByApi();
    homePage.visit();
    cy.wait('@getPlaces');
  });

  it('affiche le spinner pendant la recherche IA', () => {
    cy.intercept('POST', '**/api/morocco-ai/search', (req) => {
      req.reply({ delay: 500, fixture: 'search-results.json' });
    }).as('slowSearch');

    homePage.searchInput.clear().type('restaurant marrakech');
    homePage.searchButton.click();

    cy.get('.ed-search__btn ion-spinner').should('exist');
    cy.wait('@slowSearch');
    cy.get('.ed-search__btn ion-spinner').should('not.exist');

    cy.screenshot('ai-search-spinner');
  });

  it('désactive le bouton de recherche si le champ est vide', () => {
    homePage.searchButton.should('be.disabled');
    cy.screenshot('ai-search-button-disabled');
  });

  it('active le bouton de recherche quand le champ est rempli', () => {
    homePage.searchInput.type('riad');
    homePage.searchButton.should('not.be.disabled');
    cy.screenshot('ai-search-button-enabled');
  });

  it('envoie la bonne requête au backend IA', () => {
    homePage.search('restaurant avec vue panoramique à Tanger');

    cy.wait('@aiSearch').its('request.body').should('include.keys', ['query']);
    cy.screenshot('ai-search-request');
  });

  it('affiche plusieurs résultats après la recherche', () => {
    homePage.search('plage agadir');
    cy.wait('@aiSearch');

    cy.get('.hm-card, .hm-mini-card').should('have.length.at.least', 1);
    cy.screenshot('ai-search-multiple-results');
  });

  it('affiche la narration IA avec le bon contenu', () => {
    homePage.search('plage agadir');
    cy.wait('@aiSearch');

    cy.get('.ed-ai').should('be.visible');
    cy.get('.ed-ai__icon ion-icon').should('have.attr', 'name', 'sparkles');
    cy.get('.ed-ai__text').should('not.be.empty');
    cy.screenshot('ai-narration-content');
  });

  it('peut utiliser un prompt suggéré comme point de départ', () => {
    cy.get('.ed-hero').should('be.visible');

    cy.get('.ed-search__input').find('input').type('plage calme a Agadir');
    homePage.searchButton.click();

    cy.wait('@aiSearch');
    cy.get('.hm-card').should('be.visible');
    cy.screenshot('ai-suggested-prompt');
  });

  it('gère une erreur réseau et bascule en mode fallback', () => {
    cy.intercept('POST', '**/api/morocco-ai/search', { forceNetworkError: true }).as('failedSearch');
    cy.intercept('GET', '**/api/morocco-ai/search**', { forceNetworkError: true }).as('failedSearchGet');

    homePage.search('plage agadir');

    cy.get('.hm-card, .hm-mini-card').should('have.length.at.least', 1);
    cy.screenshot('ai-search-fallback');
  });
});
