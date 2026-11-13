/// <reference path="./globals.d.ts" />
import { createCouncilService } from './council.js';
import { createDatabase } from './database.js';
import { createMessageService } from './messages.js';
import { createAgentService } from './agents.js';

// --- UI State ---
let dbInstance: ReturnType<typeof createDatabase>;
let councilService: ReturnType<typeof createCouncilService>;
let messageService: ReturnType<typeof createMessageService>;
let currentSession: 'claude' | 'hermes' = 'claude';
let currentSeat: string | null = null;

// --- Element References ---
const appElement = document.getElementById('app') as HTMLDivElement;
const viewScreen = document.getElementById('view-screen') as HTMLDivElement;
const viewName = document.getElementById('view-name') as HTMLSpanElement;

// Dashboard views
const dashboardView = document.getElementById('dashboard-view') as HTMLDivElement;
const chatView = document.getElementById('chat-view') as HTMLDivElement;
const councilView = document.getElementById('council-view') as HTMLDivElement;
const memoryView = document.getElementById('memory-view') as HTMLDivElement;
const meetingsView = document.getElementById('meetings-view') as HTMLDivElement;

// Navigation
const navItems = document.querySelectorAll<HTMLElement>('.nav-item');
const viewButtons = document.querySelectorAll<HTMLElement>('.view-btn');

// Chat elements
const chatMessages = document.getElementById('chat-messages') as HTMLDivElement;
const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

// Council elements
const seatsContainer = document.getElementById('seats-container') as HTMLDivElement;
const meetingsContainer = document.getElementById('meetings-container') as HTMLDivElement;

// Memory elements
const memoryCategories = document.getElementById('memory-categories') as HTMLDivElement;
const memorySearch = document.getElementById('memory-search') as HTMLInputElement;

// --- Initialize Services ---
function initServices() {
  const db = createDatabase(path.join(process.cwd(), 'data/council-phase5.db'));
  dbInstance = db;
  councilService = createCouncilService(dbInstance);
  messageService = createMessageService(dbInstance, createAgentService(dbInstance));

  // Initialize council with founding members
  councilService.createSeat({ seat_id: 'seat-01', name: 'Steve Jobs', status: 'permanent', is_founder: true, description: '' });
  councilService.createSeat({ seat_id: 'seat-02', name: 'Virgil Abloh', status: 'permanent', is_founder: true, description: '' });
  councilService.createSeat({ seat_id: 'seat-03', name: 'Shawn Stüssy', status: 'permanent', is_founder: true, description: '' });
  councilService.createSeat({ seat_id: 'seat-04', name: 'G-Dragon', status: 'permanent', is_founder: true, description: '' });
  // Note: remaining 7 seats appointed by Founder per Phase 6 (not invented here)

  // Create founding personas (from the 4 permanent member files)
  councilService.createPersona({ persona_id: 'persona-steve-jobs', seat_id: 'seat-01', name: 'Steve Jobs', description: 'Co-Founder, Apple Inc.', traits: 'visionary, minimalist, perfectionist' });
  councilService.createPersona({ persona_id: 'persona-virgil-abloh', seat_id: 'seat-02', name: 'Virgil Abloh', description: 'Founder, Off-White; Artistic Director, Louis Vuitton Menswear', traits: '3% rule, cultural translator, generosity' });
  councilService.createPersona({ persona_id: 'persona-shawn-stussy', seat_id: 'seat-03', name: 'Shawn Stüssy', description: 'Founder, Stüssy', traits: 'authenticity, anti-corporate, craft-first' });
  councilService.createPersona({ persona_id: 'persona-g-dragon', seat_id: 'seat-04', name: 'G-Dragon', description: 'Artist, BIGBANG; Founder, PEACEMINUSONE', traits: 'duality, trendsetter, artistic integrity' });

  // Assign personas to both runtimes
  for (const runtime of ['claude', 'hermes']) {
    councilService.assignPersonaToRuntime(runtime, 'persona-steve-jobs');
    councilService.assignPersonaToRuntime(runtime, 'persona-virgil-abloh');
    councilService.assignPersonaToRuntime(runtime, 'persona-shawn-stussy');
    councilService.assignPersonaToRuntime(runtime, 'persona-g-dragon');
  }
}

// --- Navigation ---
function showView(view: HTMLDivElement) {
  // Hide all views
  [dashboardView, chatView, councilView, memoryView, meetingsView].forEach(v => v.classList.add('hidden'));

  // Show selected view
  if (view) view.classList.remove('hidden');

  // Update URL/hash
  history.pushState({}, '', `#${view.id}`);
}

// --- Render Council Seats ---
function renderCouncilSeats() {
  const seats = councilService.listSeats();
  seatsContainer.innerHTML = '';

  seats.forEach(seat => {
    // seat type has emoji field via extension, use fallback
    const emoji = (seat as any).emoji || '🜿';
    const persona = councilService.getPersonaBySeat(seat.seat_id);
    const seatCard = document.createElement('div');
    seatCard.className = 'seat-card';
    seatCard.innerHTML = `
      <div class="seat-header">
        <span class="seat-emoji">${emoji}</span>
        <span class="seat-id">${seat.seat_id}</span>
      </div>
      <div class="seat-name">${seat.name}</div>
      <div class="seat-status ${seat.status}">${seat.status}</div>
      ${persona ? `<div class="seat-persona">(${persona.name})</div>` : ''}
    `;
    seatsContainer.appendChild(seatCard);
  });
}

// --- Render Meetings ---
function renderMeetings() {
  const meetings = councilService.listMeetings();
  meetingsContainer.innerHTML = '';

  meetings.forEach(meeting => {
    const phases = councilService.getMeetingPhases(meeting.meeting_id);
    const meetingCard = document.createElement('div');
    meetingCard.className = 'meeting-card';
    meetingCard.innerHTML = `
      <div class="meeting-header">
        <span class="meeting-number">Meeting ${meeting.number}</span>
        <span class="meeting-status ${meeting.status}">${meeting.status}</span>
      </div>
      <div class="meeting-phases">
        ${phases.map((p: any) => `<span class="phase-tag ${p.status}">${p.phase}</span>`).join(' ')}
      </div>
    `;
    meetingsContainer.appendChild(meetingCard);
  });
}

// --- Render Memory Categories ---
function renderMemoryCategories() {
  const categories = [
    'individual_persona', 'council_shared', 'meeting_history', 'decision_resolution',
    'idea_proposal', 'research_evidence', 'lesson_learned', 'unresolved_question',
    'division_shared', 'division_private', 'staff_private', 'business_context',
    'task_history', 'cross_division'
  ];

  memoryCategories.innerHTML = '';

  categories.forEach(category => {
    const memories = councilService.getMemoryEntriesByCategory(
      { owner_type: 'seat', owner_id: 'seat-01', runtime: 'claude' },
      category as any
    );
    const catEl = document.createElement('div');
    catEl.className = 'memory-category';
    catEl.innerHTML = `
      <div class="category-header">
        <span>${category.replace(/_/g, ' ')}</span>
        <span class="count">(${memories.length})</span>
      </div>
    `;
    memoryCategories.appendChild(catEl);
  });
}

// --- Chat Functions ---
function appendMessage(text: string, sender: 'user' | 'system' | 'agent' = 'system', isOwn = false) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${isOwn ? 'own' : ''}`;
  msgEl.textContent = text;
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

sendBtn.addEventListener('click', () => {
  const text = messageInput.value.trim();
  if (!text) return;

  try {
    const message = messageService.sendMessage({
      sender_id: `user-${currentSession}`,
      recipient_id: ' council',
      content: text,
    });
    appendMessage(`You: ${text}`, 'user', true);
    messageInput.value = '';
  } catch (e) {
    appendMessage(`Error: ${(e as Error).message}`, 'system');
  }
});

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendBtn.click();
});

// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
  initServices();
  renderCouncilSeats();
  renderMeetings();
  renderMemoryCategories();

  // Set up navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view') as keyof typeof dashboardView;
      showView(document.getElementById(`${viewId}-view`) as HTMLDivElement);
    });
  });

  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.getAttribute('data-view') as keyof typeof dashboardView;
      showView(document.getElementById(`${viewId}-view`) as HTMLDivElement);
    });
  });

  // Hash-based navigation
  const hash = window.location.hash.substring(1);
  if (hash) {
    const el = document.getElementById(`${hash}-view`);
    if (el) showView(el as HTMLDivElement);
  }
});