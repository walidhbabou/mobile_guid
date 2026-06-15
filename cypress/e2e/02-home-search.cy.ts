import { HomePage } from '../pages/home.page';

const homePage = new HomePage();

describe('02 — Accueil & Recherche IA', () => {
  beforeEach(() => {
    cy.interceptApiCalls();
    cy.loginByApi();
    homePage.visit();
    cy.wait('@getPlaces');
  });

  it('affiche la page d\'accueil avec le hero et la barre de recherche', () => {
    cy.get('.ed-hero').should('be.visible');
    cy.get('.ed-search').should('be.visible');
    cy.contains('Explorez').should('be.visible');
    cy.contains('le Maroc').should('be.visible');
    cy.screenshot('home-initial');
  });

  it('affiche les cartes lieux au chargement', () => {
    cy.get('.hm-card, .hm-mini-card').should('have.length.at.least', 1);
    cy.screenshot('home-places-loaded');
  });

  it('effectue une recherche IA et affiche les résultats', () => {
    homePage.search('plage calme à Agadir');

    cy.wait('@aiSearch');

    cy.get('.hm-card').should('be.visible');
    cy.get('.ed-ai').should('be.visible');
    cy.contains('Résultats').should('be.visible');
    cy.screenshot('home-search-results');
  });

  it('affiche la narration IA après la recherche', () => {
    homePage.search('plage agadir');

    cy.wait('@aiSearch');

    cy.get('.ed-ai__text').should('contain.text', 'trouvé');
    cy.screenshot('home-ai-narration');
  });

  it('affiche un état vide pour une recherche sans résultat', () => {
    cy.intercept('POST', '**/api/morocco-ai/search', {
      body: { results: [], results_count: 0 },
    }).as('emptySearch');
    cy.intercept('GET', '**/api/morocco-ai/search**', {
      body: { results: [], results_count: 0 },
    }).as('emptySearchGet');

    homePage.search('xzxzxzxz lieu inexistant');

    cy.wait('@emptySearch');

    cy.get('.hm-empty').should('be.visible');
    cy.contains('Aucun lieu trouvé').should('be.visible');
    cy.screenshot('home-empty-state');
  });

  it('efface les résultats de recherche avec le bouton Effacer', () => {
    homePage.search('plage agadir');
    cy.wait('@aiSearch');
    cy.contains('Résultats').should('be.visible');

    homePage.clearSearch();

    cy.contains('À découvrir').should('be.visible');
    cy.screenshot('home-search-cleared');
  });

  it('filtre les lieux par catégorie', () => {
    cy.get('.ed-chip').should('have.length.at.least', 1);
    cy.get('.ed-chip').eq(0).click();

    cy.screenshot('home-filter-applied');
  });

  it('affiche le badge Suggestion IA sur les résultats de recherche', () => {
    homePage.search('plage agadir');
    cy.wait('@aiSearch');

    cy.get('.hm-tag').contains('IA').should('be.visible');
    cy.screenshot('home-ai-badge');
  });
});
