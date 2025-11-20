// Modal-Funktionalität
function initModals() {
  // Alle Modal-Trigger finden
  const triggers = document.querySelectorAll('[data-modal-trigger]');
  
  triggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = trigger.getAttribute('data-modal-trigger');
      const modal = document.getElementById(modalId);
      
      if (modal) {
        openModal(modal);
      }
    });
  });

  // Alle Close-Buttons finden
  const closeButtons = document.querySelectorAll('[data-modal-close]');
  
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      const modal = button.closest('.modal');
      if (modal) {
        closeModal(modal);
      }
    });
  });

  // ESC-Taste zum Schließen
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal.is-open');
      if (openModal) {
        closeModal(openModal);
      }
    }
  });
}

function openModal(modal) {
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  
  // Focus auf das Modal setzen
  const closeButton = modal.querySelector('[data-modal-close]');
  if (closeButton) {
    closeButton.focus();
  }
}

function closeModal(modal) {
  modal.classList.remove('is-open');
  document.body.style.overflow = '';
}

// Initialisierung
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModals);
} else {
  initModals();
}

