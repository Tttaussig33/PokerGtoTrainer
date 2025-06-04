// integration.js - Main game logic and integration
import { createDeck, drawCards, formatCard, evaluateHand, generatePuzzle } from './generator.js';

// Poker Game State Management
export class PokerGTOTrainer {
  constructor() {
    this.gameState = {
      street: 'preflop', // preflop, flop, turn, river
      pot: 3, // Start with blinds
      heroStack: 97,
      opponentStack: 98,
      toCall: 2,
      heroCards: [],
      opponentCards: [],
      communityCards: [],
      currentHand: null,
      handHistory: this.loadFromStorage('pokerHandHistory', []),
      stats: this.loadFromStorage('pokerStats', {}),
      currentAction: null
    };
    
    this.initializeStats();
    this.setupEventListeners();
    this.newHand();
    this.updateDisplays();
  }

  loadFromStorage(key, defaultValue) {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || 'null');
      return stored || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  initializeStats() {
    const defaultStats = {
      totalHands: 0,
      correctDecisions: 0,
      incorrectDecisions: 0,
      streakCurrent: 0,
      streakBest: 0,
      evSaved: 0,
      mistakesByStreet: { preflop: 0, flop: 0, turn: 0, river: 0 },
      accuracyByPosition: {},
      sessionStats: []
    };
    
    this.gameState.stats = { ...defaultStats, ...this.gameState.stats };
  }

  setupEventListeners() {
    // Check if elements exist before adding event listeners
    const foldBtn = document.getElementById('fold-btn');
    const callBtn = document.getElementById('call-btn');
    const raiseBtn = document.getElementById('raise-btn');
    const confirmRaiseBtn = document.getElementById('confirm-raise');
    const cancelRaiseBtn = document.getElementById('cancel-raise');
    const nextHandBtn = document.getElementById('next-hand-btn');
    const raiseSlider = document.getElementById('raise-slider');
    const resetStatsBtn = document.getElementById('reset-stats');

    if (foldBtn) foldBtn.addEventListener('click', () => this.makeAction('fold'));
    if (callBtn) callBtn.addEventListener('click', () => this.makeAction('call'));
    if (raiseBtn) raiseBtn.addEventListener('click', () => this.showRaiseControls());
    if (confirmRaiseBtn) confirmRaiseBtn.addEventListener('click', () => this.confirmRaise());
    if (cancelRaiseBtn) cancelRaiseBtn.addEventListener('click', () => this.hideRaiseControls());
    if (nextHandBtn) nextHandBtn.addEventListener('click', () => this.newHand());
    
    if (raiseSlider) {
      raiseSlider.addEventListener('input', (e) => {
        const displayElement = document.getElementById('raise-display');
        if (displayElement) {
          displayElement.textContent = e.target.value;
        }
      });
    }

    // Tab switching
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach(tab => {
      tab.addEventListener('shown.bs.tab', (e) => {
        if (e.target.id === 'analytics-tab') {
          this.updateAnalytics();
        } else if (e.target.id === 'history-tab') {
          this.updateHandHistory();
        }
      });
    });

    // Reset stats
    if (resetStatsBtn) {
      resetStatsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all statistics?')) {
          this.resetStats();
        }
      });
    }
  }

  resetStats() {
    localStorage.removeItem('pokerStats');
    localStorage.removeItem('pokerHandHistory');
    this.gameState.stats = {};
    this.gameState.handHistory = [];
    this.initializeStats();
    this.updateDisplays();
  }

  generateDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const deck = [];
    
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(rank + suit);
      }
    }
    
    return this.shuffle(deck);
  }

  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  newHand() {
    const deck = this.generateDeck();
    
    this.gameState.heroCards = [deck.pop(), deck.pop()];
    this.gameState.opponentCards = [deck.pop(), deck.pop()];
    this.gameState.communityCards = [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()];
    
    this.gameState.street = 'preflop';
    this.gameState.pot = 3;
    this.gameState.heroStack = 97;
    this.gameState.opponentStack = 98;
    this.gameState.toCall = 2;
    this.gameState.currentHand = {
      heroCards: [...this.gameState.heroCards],
      opponentCards: [...this.gameState.opponentCards],
      communityCards: [...this.gameState.communityCards],
      actions: [],
      startTime: Date.now()
    };

    this.updateTable();
    this.hideRaiseControls();
    
    const feedbackContent = document.getElementById('feedback-content');
    const nextHandBtn = document.getElementById('next-hand-btn');
    const actionButtons = document.getElementById('action-buttons');
    
    if (feedbackContent) feedbackContent.innerHTML = '';
    if (nextHandBtn) nextHandBtn.style.display = 'none';
    if (actionButtons) actionButtons.style.display = 'block';
  }

  updateTable() {
    // Update hero cards
    const heroCard1 = document.getElementById('hero-card-1');
    const heroCard2 = document.getElementById('hero-card-2');
    if (heroCard1) heroCard1.textContent = this.gameState.heroCards[0];
    if (heroCard2) heroCard2.textContent = this.gameState.heroCards[1];
    
    // Update community cards based on street
    const communityElements = [
      'community-1', 'community-2', 'community-3', 'community-4', 'community-5'
    ];
    
    let visibleCards = this.getVisibleCommunityCards();

    communityElements.forEach((id, index) => {
      const element = document.getElementById(id);
      if (element) {
        if (index < visibleCards) {
          element.textContent = this.gameState.communityCards[index];
          element.classList.remove('hidden');
        } else {
          element.textContent = '?';
          element.classList.add('hidden');
        }
      }
    });

    // Update other display elements with null checks
    const streetIndicator = document.getElementById('street-indicator');
    const potSize = document.getElementById('pot-size');
    const heroStack = document.getElementById('hero-stack');
    const opponentStack = document.getElementById('opponent-stack');
    const callAmount = document.getElementById('call-amount');

    if (streetIndicator) streetIndicator.textContent = this.capitalizeFirst(this.gameState.street);
    if (potSize) potSize.textContent = this.gameState.pot;
    if (heroStack) heroStack.textContent = this.gameState.heroStack;
    if (opponentStack) opponentStack.textContent = this.gameState.opponentStack;
    if (callAmount) callAmount.textContent = this.gameState.toCall;
    
    // Update equity display
    this.updateEquityDisplay();
  }

  updateEquityDisplay() {
    const heroEquity = this.estimateEquity(this.gameState.heroCards, this.gameState.communityCards);
    const oppEquity = 100 - heroEquity;
    
    const heroEquityElement = document.getElementById('hero-equity');
    const opponentEquityElement = document.getElementById('opponent-equity');
    
    if (heroEquityElement) {
      heroEquityElement.style.width = heroEquity + '%';
      heroEquityElement.textContent = Math.round(heroEquity) + '%';
    }
    
    if (opponentEquityElement) {
      opponentEquityElement.style.width = oppEquity + '%';
      opponentEquityElement.textContent = Math.round(oppEquity) + '%';
    }
  }

  estimateEquity(heroCards, communityCards) {
    const handStrength = this.evaluateHandStrength(heroCards, communityCards.slice(0, this.getVisibleCommunityCards()));
    return Math.min(90, Math.max(10, 30 + handStrength * 10));
  }

  getVisibleCommunityCards() {
    switch (this.gameState.street) {
      case 'preflop': return 0;
      case 'flop': return 3;
      case 'turn': return 4;
      case 'river': return 5;
      default: return 0;
    }
  }

  evaluateHandStrength(heroCards, communityCards) {
    const cards = [...heroCards, ...communityCards];
    const ranks = cards.map(card => card[0]);
    const suits = cards.map(card => card.slice(1));
    
    // Check for pairs, high cards, etc.
    const rankCounts = {};
    ranks.forEach(rank => rankCounts[rank] = (rankCounts[rank] || 0) + 1);
    
    const pairs = Object.values(rankCounts).filter(count => count >= 2).length;
    const highCard = this.getHighCardValue(ranks);
    
    if (pairs > 0) return 4 + pairs;
    if (highCard >= 11) return 3;
    if (highCard >= 9) return 2;
    return 1;
  }

  getHighCardValue(ranks) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return Math.max(...ranks.map(rank => values[rank] || 0));
  }

  makeAction(action, amount = 0) {
    this.gameState.currentAction = { action, amount, street: this.gameState.street };
    this.gameState.currentHand.actions.push(this.gameState.currentAction);
    
    const gtoRecommendation = this.getGTORecommendation();
    const isCorrect = this.isActionCorrect(action, amount, gtoRecommendation);
    
    this.processAction(action, amount);
    this.showFeedback(action, amount, gtoRecommendation, isCorrect);
    this.updateStats(isCorrect);
    
    // Hide action buttons after decision
    const actionButtons = document.getElementById('action-buttons');
    const nextHandBtn = document.getElementById('next-hand-btn');
    
    if (actionButtons) actionButtons.style.display = 'none';
    if (nextHandBtn) nextHandBtn.style.display = 'block';
    
    // Save hand to history
    this.saveHandToHistory(isCorrect);
  }

  getGTORecommendation() {
    const handStrength = this.evaluateHandStrength(this.gameState.heroCards, 
      this.gameState.communityCards.slice(0, this.getVisibleCommunityCards()));
    
    const position = 'BTN'; // Simplified
    const potOdds = this.gameState.toCall / (this.gameState.pot + this.gameState.toCall);
    
    let recommendation = {
      primary: 'fold',
      frequency: { fold: 70, call: 20, raise: 10 },
      reasoning: 'Weak hand, fold to pressure'
    };

    if (handStrength >= 5) {
      recommendation = { primary: 'raise', frequency: { fold: 5, call: 25, raise: 70 }, reasoning: 'Strong hand, bet for value' };
    } else if (handStrength >= 3) {
      recommendation = { primary: 'call', frequency: { fold: 30, call: 50, raise: 20 }, reasoning: 'Decent hand, call to see more cards' };
    } else if (this.gameState.street === 'preflop' && this.hasBluffingOpportunity()) {
      recommendation = { primary: 'raise', frequency: { fold: 40, call: 20, raise: 40 }, reasoning: 'Bluffing opportunity with position' };
    }

    return recommendation;
  }

  hasBluffingOpportunity() {
    return Math.random() < 0.3 && this.gameState.street !== 'preflop';
  }

  isActionCorrect(action, amount, gtoRecommendation) {
    if (action === gtoRecommendation.primary) return true;
    const actionFreq = gtoRecommendation.frequency[action] || 0;
    return actionFreq >= 25;
  }

  processAction(action, amount) {
    switch (action) {
      case 'fold':
        break;
      case 'call':
        this.gameState.heroStack -= this.gameState.toCall;
        this.gameState.pot += this.gameState.toCall;
        this.advanceStreet();
        break;
      case 'raise':
        this.gameState.heroStack -= amount;
        this.gameState.pot += amount;
        this.gameState.toCall = amount - this.gameState.toCall;
        this.advanceStreet();
        break;
    }
  }

  advanceStreet() {
    const streets = ['preflop', 'flop', 'turn', 'river'];
    const currentIndex = streets.indexOf(this.gameState.street);
    
    if (currentIndex < streets.length - 1) {
      this.gameState.street = streets[currentIndex + 1];
      this.gameState.toCall = 0;
      this.updateTable();
    }
  }

  showFeedback(action, amount, gtoRecommendation, isCorrect) {
    const feedbackElement = document.getElementById('feedback-content');
    if (!feedbackElement) return;
    
    const actionText = action === 'raise' ? `${action} ${amount}` : action;
    
    let feedbackHTML = `
      <div class="card ${isCorrect ? 'border-success' : 'border-danger'} mx-auto" style="max-width: 100%;">
        <div class="card-header">
          <h5 class="${isCorrect ? 'text-success' : 'text-danger'} mb-0">
            ${isCorrect ? '✓ Correct!' : '✗ Not Optimal'}
          </h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-12">
              <p class="mb-2"><strong>Your Action:</strong> ${this.capitalizeFirst(actionText)}</p>
              <p class="mb-2"><strong>GTO Recommendation:</strong> ${this.capitalizeFirst(gtoRecommendation.primary)}</p>
              <p class="mb-3"><strong>Reasoning:</strong> ${gtoRecommendation.reasoning}</p>
            </div>
          </div>
          
          <div class="mt-3">
            <h6 class="mb-2">GTO Frequencies:</h6>
            <div class="row">
              ${Object.entries(gtoRecommendation.frequency).map(([act, freq]) => 
                `<div class="col-4">
                  <div class="d-flex justify-content-between">
                    <span>${this.capitalizeFirst(act)}:</span>
                    <span class="fw-bold">${freq}%</span>
                  </div>
                 </div>`
              ).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
    
    feedbackElement.innerHTML = feedbackHTML;
    
    // Update GTO analysis panel
    const gtoAnalysis = document.getElementById('gto-analysis');
    if (gtoAnalysis) {
      gtoAnalysis.innerHTML = `
        <div class="mb-2">
          <strong>Recommended Action:</strong><br>
          <span class="text-primary">${this.capitalizeFirst(gtoRecommendation.primary)}</span>
        </div>
        <div class="mb-2">
          <strong>Hand Strength:</strong><br>
          <span class="text-info">${this.getHandStrengthDescription()}</span>
        </div>
        <div>
          <strong>Position:</strong><br>
          <span class="text-success">Button (Favorable)</span>
        </div>
      `;
    }
  }

  getHandStrengthDescription() {
    const strength = this.evaluateHandStrength(this.gameState.heroCards, 
      this.gameState.communityCards.slice(0, this.getVisibleCommunityCards()));
    
    if (strength >= 5) return 'Strong';
    if (strength >= 3) return 'Medium';
    if (strength >= 2) return 'Weak';
    return 'Very Weak';
  }

  updateStats(isCorrect) {
    this.gameState.stats.totalHands++;
    
    if (isCorrect) {
      this.gameState.stats.correctDecisions++;
      this.gameState.stats.streakCurrent++;
      this.gameState.stats.streakBest = Math.max(this.gameState.stats.streakBest, this.gameState.stats.streakCurrent);
      this.gameState.stats.evSaved += this.calculateEVSaved();
    } else {
      this.gameState.stats.incorrectDecisions++;
      this.gameState.stats.streakCurrent = 0;
      this.gameState.stats.mistakesByStreet[this.gameState.street]++;
    }
    
    this.saveStats();
    this.updateDisplays();
  }

  calculateEVSaved() {
    return Math.random() * 10 + 5;
  }

  saveStats() {
    localStorage.setItem('pokerStats', JSON.stringify(this.gameState.stats));
  }

  saveHandToHistory(isCorrect) {
    const handRecord = {
      id: Date.now(),
      heroCards: [...this.gameState.currentHand.heroCards],
      communityCards: [...this.gameState.currentHand.communityCards],
      actions: [...this.gameState.currentHand.actions],
      isCorrect,
      timestamp: Date.now(),
      street: this.gameState.street,
      pot: this.gameState.pot
    };
    
    this.gameState.handHistory.unshift(handRecord);
    
    if (this.gameState.handHistory.length > 100) {
      this.gameState.handHistory = this.gameState.handHistory.slice(0, 100);
    }
    
    localStorage.setItem('pokerHandHistory', JSON.stringify(this.gameState.handHistory));
  }

  updateDisplays() {
    const accuracy = this.gameState.stats.totalHands > 0 ? 
      Math.round((this.gameState.stats.correctDecisions / this.gameState.stats.totalHands) * 100) : 0;
    
    const sessionAccuracy = document.getElementById('session-accuracy');
    const currentStreak = document.getElementById('current-streak');
    const handsPlayed = document.getElementById('hands-played');
    const evSaved = document.getElementById('ev-saved');
    
    if (sessionAccuracy) sessionAccuracy.textContent = accuracy + '%';
    if (currentStreak) currentStreak.textContent = this.gameState.stats.streakCurrent;
    if (handsPlayed) handsPlayed.textContent = this.gameState.stats.totalHands;
    if (evSaved) evSaved.textContent = '$' + Math.round(this.gameState.stats.evSaved);
  }

  updateHandHistory() {
    const container = document.getElementById('hand-history-container');
    if (!container) return;
    
    if (this.gameState.handHistory.length === 0) {
      container.innerHTML = '<p class="text-muted">No hands played yet. Start a training session to see your hand history.</p>';
      return;
    }
    
    const historyHTML = this.gameState.handHistory.map(hand => `
      <div class="hand-history-item ${hand.isCorrect ? 'correct' : 'incorrect'}" onclick="showHandDetails(${hand.id})">
        <div class="row">
          <div class="col-md-3">
            <strong>Hand:</strong> ${hand.heroCards.join(' ')}
          </div>
          <div class="col-md-3">
            <strong>Board:</strong> ${hand.communityCards.slice(0, this.getStreetCards(hand.street)).join(' ') || 'Pre-flop'}
          </div>
          <div class="col-md-2">
            <span class="badge ${hand.isCorrect ? 'bg-success' : 'bg-danger'}">
              ${hand.isCorrect ? 'Correct' : 'Incorrect'}
            </span>
          </div>
          <div class="col-md-2">
            <small>${this.capitalizeFirst(hand.street)}</small>
          </div>
          <div class="col-md-2">
            <small>${new Date(hand.timestamp).toLocaleTimeString()}</small>
          </div>
        </div>
      </div>
    `).join('');
    
    container.innerHTML = historyHTML;
  }

  getStreetCards(street) {
    switch (street) {
      case 'preflop': return 0;
      case 'flop': return 3;
      case 'turn': return 4;
      case 'river': return 5;
      default: return 0;
    }
  }

  updateAnalytics() {
    this.updateDetailedStats();
  }

  updateDetailedStats() {
    const stats = this.gameState.stats;
    const container = document.getElementById('detailed-stats');
    if (!container) return;
    
    const accuracy = stats.totalHands > 0 ? (stats.correctDecisions / stats.totalHands * 100).toFixed(1) : 0;
    const totalMistakes = Object.values(stats.mistakesByStreet).reduce((a, b) => a + b, 0);
    
    container.innerHTML = `
      <div class="col-md-3">
        <div class="text-center">
          <h4>${accuracy}%</h4>
          <p class="text-muted">Overall Accuracy</p>
        </div>
      </div>
      <div class="col-md-3">
        <div class="text-center">
          <h4>${stats.streakBest}</h4>
          <p class="text-muted">Best Streak</p>
        </div>
      </div>
      <div class="col-md-3">
        <div class="text-center">
          <h4>${totalMistakes}</h4>
          <p class="text-muted">Total Mistakes</p>
        </div>
      </div>
      <div class="col-md-3">
        <div class="text-center">
          <h4>$${Math.round(stats.evSaved)}</h4>
          <p class="text-muted">EV Saved</p>
        </div>
      </div>
      
      <div class="col-12 mt-4">
        <h6>Mistakes by Street:</h6>
        ${Object.entries(stats.mistakesByStreet).map(([street, count]) => `
          <div class="d-flex justify-content-between mb-2">
            <span>${this.capitalizeFirst(street)}:</span>
            <span class="badge bg-secondary">${count}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  showRaiseControls() {
    const raiseControls = document.getElementById('raise-controls');
    const actionButtons = document.getElementById('action-buttons');
    
    if (raiseControls) raiseControls.style.display = 'block';
    if (actionButtons) actionButtons.style.display = 'none';
    
    const minRaise = this.gameState.toCall * 2;
    const maxRaise = this.gameState.heroStack;
    const slider = document.getElementById('raise-slider');
    const raiseDisplay = document.getElementById('raise-display');
    
    if (slider) {
      slider.min = minRaise;
      slider.max = maxRaise;
      slider.value = Math.min(minRaise * 2, maxRaise);
      
      if (raiseDisplay) {
        raiseDisplay.textContent = slider.value;
      }
    }
  }

  hideRaiseControls() {
    const raiseControls = document.getElementById('raise-controls');
    const actionButtons = document.getElementById('action-buttons');
    
    if (raiseControls) raiseControls.style.display = 'none';
    if (actionButtons) actionButtons.style.display = 'block';
  }

  confirmRaise() {
    const slider = document.getElementById('raise-slider');
    const amount = slider ? parseInt(slider.value) : 20;
    this.hideRaiseControls();
    this.makeAction('raise', amount);
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}