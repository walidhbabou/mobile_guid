export class LoginPage {
  visit() {
    cy.visit('/auth/login');
    cy.waitForIonicApp();
    return this;
  }

  get identifierInput() {
    return cy.get('[formcontrolname="identifier"]').find('input');
  }

  get passwordInput() {
    return cy.get('[formcontrolname="password"]').find('input');
  }

  get submitButton() {
    return cy.get('.cta-btn');
  }

  get errorMessage() {
    return cy.get('.error-msg, ion-toast');
  }

  get signupLink() {
    return cy.contains('button', "S'inscrire");
  }

  get forgotPasswordLink() {
    return cy.get('.forgot-btn');
  }

  fillIdentifier(value: string) {
    this.identifierInput.clear().type(value);
    return this;
  }

  fillPassword(value: string) {
    this.passwordInput.clear().type(value);
    return this;
  }

  submit() {
    this.submitButton.click();
    return this;
  }

  fillAndSubmit(identifier: string, password: string) {
    this.fillIdentifier(identifier);
    this.fillPassword(password);
    this.submit();
    return this;
  }
}
