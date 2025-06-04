// main.js - Main entry point for Poker GTO Trainer
import { PokerGTOTrainer } from './integration.js';

// Global trainer instance
let trainer;

// Global function for hand details (referenced in HTML)
window.showHandDetails = function(handId) {
  if (trainer && trainer.gameState && trainer.gameState.handHistory) {
    const hand = trainer.gameState.handHistory.find(h => h.id === handId);
    if (hand) {
      alert(`Hand Details:\nHero: ${hand.heroCards.join(' ')}\nBoard: ${hand.communityCards.join(' ')}\nActions: ${hand.actions.map(a => a.action).join(', ')}`);
    }
  }
};

// Initialize the trainer when page loads
document.addEventListener('DOMContentLoaded', () => {
  try {
    trainer = new PokerGTOTrainer();
  } catch (error) {
    console.error('Error initializing poker trainer:', error);
  }
});

// Export trainer for external access if needed
export { trainer };