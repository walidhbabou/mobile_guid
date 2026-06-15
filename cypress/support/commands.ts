declare global {
  namespace Cypress {
    interface Chainable {
      login(username?: string, password?: string): Chainable<void>;
      loginByApi(): Chainable<void>;
      interceptApiCalls(): Chainable<void>;
      typeInIonInput(selector: string, text: string): Chainable<void>;
      waitForIonicApp(): Chainable<void>;
    }
  }
}

const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJ0ZXN0dXNlciIsImV4cCI6OTk5OTk5OTk5OX0' +
  '.test-signature';

// Injecte le token directement dans localStorage pour bypasser le formulaire de login
Cypress.Commands.add('loginByApi', () => {
  cy.window().then((win) => {
    win.localStorage.setItem('accessToken', TEST_TOKEN);
    win.localStorage.setItem('token', TEST_TOKEN);
    win.localStorage.setItem('isLoggedIn', 'true');
    win.localStorage.setItem('userName', 'Test User');
    win.localStorage.setItem('userEmail', 'testuser@example.com');
  });
});

// Login via le formulaire UI
Cypress.Commands.add('login', (username = 'testuser', password = 'Test1234!') => {
  cy.intercept('POST', '**/api/auth/signin', { fixture: 'auth-response.json' }).as('signin');
  cy.intercept('GET', '**/api/auth/me', { fixture: 'user-profile.json' }).as('profile');

  cy.visit('/auth/login');
  cy.waitForIonicApp();

  cy.typeInIonInput('[formcontrolname="identifier"]', username);
  cy.typeInIonInput('[formcontrolname="password"]', password);
  cy.get('.cta-btn').click();

  cy.wait('@signin');
  cy.url().should('include', '/tabs');
});

// Intercepte tous les appels API courants
Cypress.Commands.add('interceptApiCalls', () => {
  cy.intercept('GET', '**/api/morocco-ai/places', { fixture: 'places.json' }).as('getPlaces');
  cy.intercept('POST', '**/api/morocco-ai/search', { fixture: 'search-results.json' }).as('aiSearch');
  cy.intercept('GET', '**/api/morocco-ai/search**', { fixture: 'search-results.json' }).as('aiSearchGet');
  cy.intercept('GET', '**/api/morocco-ai/places/by-place-id/**', { fixture: 'place-detail.json' }).as('getPlaceDetail');
  cy.intercept('GET', '**/api/auth/me', { fixture: 'user-profile.json' }).as('getProfile');
  cy.intercept('POST', '**/api/auth/validate', { body: { valid: true, userId: 1 } }).as('validateToken');
  cy.intercept('GET', '**/api/core/favorites/user/**', { body: [] }).as('getFavorites');
  cy.intercept('POST', '**/api/favorites', { body: { id: 100, userId: 1, placeId: 1 } }).as('addFavorite');
  cy.intercept('DELETE', '**/api/favorites/**', { body: {} }).as('removeFavorite');
  cy.intercept('GET', '**/api/core/categories', { body: [] }).as('getCategories');
  cy.intercept('GET', '**/api/core/history/user/**', { body: [] }).as('getHistory');
  cy.intercept('POST', '**/api/core/reviews', { body: { id: 1, rating: 5, comment: 'Super!', userId: 1, placeId: 1 } }).as('postReview');
  cy.intercept('GET', '**/api/core/reviews/place/**', { body: [] }).as('getReviews');
});

// Tape du texte dans un ion-input (shadow DOM)
Cypress.Commands.add('typeInIonInput', (selector: string, text: string) => {
  cy.get(selector).find('input').clear().type(text);
});

// Attend que l'app Ionic soit chargée
Cypress.Commands.add('waitForIonicApp', () => {
  cy.get('ion-app', { timeout: 10000 }).should('exist');
});

export {};
