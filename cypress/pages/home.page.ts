export class HomePage {
  visit() {
    cy.visit('/tabs/home');
    cy.waitForIonicApp();
    return this;
  }

  get searchInput() {
    return cy.get('.ed-search__input').find('input');
  }

  get searchButton() {
    return cy.get('.ed-search__btn');
  }

  get micButton() {
    return cy.get('.ed-search__mic');
  }

  get featuredCard() {
    return cy.get('.hm-card').first();
  }

  get miniCards() {
    return cy.get('.hm-mini-card');
  }

  get aiNarration() {
    return cy.get('.ed-ai');
  }

  get emptyState() {
    return cy.get('.hm-empty');
  }

  get filterChips() {
    return cy.get('.ed-chip');
  }

  search(query: string) {
    this.searchInput.clear().type(query);
    this.searchButton.click();
    return this;
  }

  clearSearch() {
    cy.contains('button', 'Effacer').click();
    return this;
  }

  openFirstPlaceDetail() {
    cy.get('.hm-card').first()
      .find('ion-button').first()
      .click();
    return this;
  }

  toggleFavoriteOnCard() {
    cy.get('.hm-card__fav').first().click();
    return this;
  }

  toggleFavoriteOnMiniCard(index = 0) {
    cy.get('.hm-mini-card__fav').eq(index).click();
    return this;
  }

  selectFilter(label: string) {
    cy.contains('.ed-chip', label).click();
    return this;
  }
}
