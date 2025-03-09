// Definition des Custom Elements für die IBAN-Validierung
class IbanValidator extends HTMLElement {
  constructor() {
    super();
    this.ibanTimer = null;
  }

  // Wird aufgerufen, wenn das Element in das DOM eingefügt wird
  connectedCallback() {
    // IDs aus Attributen holen
    const ibanInputId = this.getAttribute('iban-input-id');
    const bicInputId = this.getAttribute('bic-input-id');
    const bankInputId = this.getAttribute('bank-input-id');
    const validationMsgId = this.getAttribute('validation-msg-id');
    
    // Elemente holen
    this.ibanInput = document.getElementById(ibanInputId);
    this.bicInput = document.getElementById(bicInputId);
    this.bankInput = document.getElementById(bankInputId);
    this.validationMsg = document.getElementById(validationMsgId);
    
    if (this.ibanInput && this.bicInput && this.bankInput) {
      // Event-Listener für IBAN-Input hinzufügen
      this.bicInput.setAttribute('disabled', 'true');
      this.bankInput.setAttribute('disabled', 'true');
      this.ibanInput.addEventListener('input', this.handleIbanInput.bind(this));
    } else {
      console.error('Eines der benötigten Felder wurde nicht gefunden.');
    }
  }
  
  // Handler für Input-Event
  handleIbanInput(e) {
    // Text ohne Leerzeichen formatieren
    const formattedIban = e.target.value.replace(/\s/g, '').toUpperCase();
    this.ibanInput.value = formattedIban;

    // Bestehende Timer löschen und einen neuen erstellen
    clearTimeout(this.ibanTimer);
    
    // Validierungs-Meldung ausblenden während der Eingabe
    if (this.validationMsg) {
      this.validationMsg.style.display = 'none';
    }
    
    // Validierung nach halber Sekunde durchführen, wenn keine Eingabe mehr erfolgt
    this.ibanTimer = setTimeout(() => {
      if (formattedIban.length > 0) {
        try {
          if(!window.ibantoolsGermany || !window.ibantoolsGermany.isValidIBAN){
            console.error("IBAN-Tool Germany nicht geladen");
            return;
          }
          if(!window.bankdataGermany || !window.bankdataGermany.bankDataByIBAN){
            console.error("Bankdata Germany nicht geladen");
            return;
          }
          // IBAN validieren und Bankdaten abrufen
          const validIban = window.ibantoolsGermany.isValidIBAN(formattedIban);
          const bankData = window.bankdataGermany.bankDataByIBAN(formattedIban);

          if (bankData && validIban) {
            // Formular mit Bankdaten ausfüllen
            this.bicInput.value = bankData.bic || '';
            this.bankInput.value = bankData.bankName || '';
            
            // Validierungs-Meldung ausblenden
            if (this.validationMsg) {
              this.validationMsg.style.display = 'none';
            }
            
            // IBAN als gültig markieren für die Form-Validierung
            this.ibanInput.setCustomValidity('');
          } else {
            // IBAN ist ungültig
            this.bicInput.value = '';
            this.bankInput.value = '';
            if (this.validationMsg) {
              this.validationMsg.style.display = 'block';
            }
            this.ibanInput.setCustomValidity('Ungültige IBAN');
          }
        } catch (error) {
          // Bei Fehler in der Validierung
          console.error('Fehler bei der IBAN-Validierung:', error);
          this.bicInput.value = '';
          this.bankInput.value = '';
          if (this.validationMsg) {
            this.validationMsg.style.display = 'block';
          }
          this.ibanInput.setCustomValidity('Ungültige IBAN');
        }
      } else {
        // Wenn IBAN leer ist
        this.bicInput.value = '';
        this.bankInput.value = '';
        if (this.validationMsg) {
          this.validationMsg.style.display = 'none';
        }
        this.ibanInput.setCustomValidity('');
      }
    }, 500); // 500ms Wartezeit
  }
}

// Registrieren des Custom Elements
customElements.define('iban-validator', IbanValidator);