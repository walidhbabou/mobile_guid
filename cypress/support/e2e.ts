import './commands';

// Nettoie le localStorage entre chaque test pour isoler les sessions
beforeEach(() => {
  cy.clearLocalStorage();
  cy.clearCookies();
});

// Capture une screenshot à chaque échec
Cypress.on('fail', (error) => {
  throw error;
});

// Ignore les erreurs Ionic/Angular non critiques (ex: ResizeObserver)
Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes('ResizeObserver') ||
    err.message.includes('Non-Error promise rejection') ||
    err.message.includes('NG0')
  ) {
    return false;
  }

  return true;
});
