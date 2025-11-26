import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SLOTS_FILE = path.join(DATA_DIR, 'time-slots.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

export interface TimeSlot {
	id: string;
	date: string; // YYYY-MM-DD
	time: string; // HH:MM (Startzeit)
	endTime?: string; // HH:MM (Endzeit, optional)
	maxCapacity: number;
	available: number;
	createdAt: string;
}

export interface Booking {
  id: string;
  slotId: string;
  name: string;
  email: string;
  phone?: string;
  participants: number;
  notes?: string;
  createdAt: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

// Sicherstellen, dass das Data-Verzeichnis existiert
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Sicherstellen, dass die Dateien existieren
async function ensureFile(filePath: string, defaultData: any) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
  }
}

// Time Slots
export async function getTimeSlots(): Promise<TimeSlot[]> {
  await ensureDataDir();
  await ensureFile(SLOTS_FILE, []);
  const data = await fs.readFile(SLOTS_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function saveTimeSlots(slots: TimeSlot[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SLOTS_FILE, JSON.stringify(slots, null, 2));
}

export async function addTimeSlot(slot: Omit<TimeSlot, 'id' | 'createdAt'>): Promise<TimeSlot> {
  const slots = await getTimeSlots();
  const newSlot: TimeSlot = {
    ...slot,
    id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  slots.push(newSlot);
  await saveTimeSlots(slots);
  return newSlot;
}

export async function deleteTimeSlot(id: string): Promise<boolean> {
  const slots = await getTimeSlots();
  const filteredSlots = slots.filter(s => s.id !== id);
  if (filteredSlots.length === slots.length) return false;
  await saveTimeSlots(filteredSlots);
  return true;
}

export async function updateTimeSlot(id: string, updates: Partial<TimeSlot>): Promise<TimeSlot | null> {
  const slots = await getTimeSlots();
  const index = slots.findIndex(s => s.id === id);
  if (index === -1) return null;
  slots[index] = { ...slots[index], ...updates };
  await saveTimeSlots(slots);
  return slots[index];
}

// Bookings
export async function getBookings(): Promise<Booking[]> {
  await ensureDataDir();
  await ensureFile(BOOKINGS_FILE, []);
  const data = await fs.readFile(BOOKINGS_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function saveBookings(bookings: Booking[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

export async function addBooking(booking: Omit<Booking, 'id' | 'createdAt' | 'status'>): Promise<Booking | null> {
  const bookings = await getBookings();
  const slots = await getTimeSlots();
  
  // Finde den Slot
  const slot = slots.find(s => s.id === booking.slotId);
  if (!slot) return null;
  
  // Prüfe Verfügbarkeit
  if (slot.available < booking.participants) return null;
  
  // Erstelle Buchung
  const newBooking: Booking = {
    ...booking,
    id: `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    status: 'confirmed',
  };
  
  bookings.push(newBooking);
  await saveBookings(bookings);
  
  // Aktualisiere Slot-Verfügbarkeit
  slot.available -= booking.participants;
  await updateTimeSlot(slot.id, { available: slot.available });
  
  return newBooking;
}

export async function getBookingsBySlot(slotId: string): Promise<Booking[]> {
  const bookings = await getBookings();
  return bookings.filter(b => b.slotId === slotId && b.status !== 'cancelled');
}

export async function cancelBooking(id: string): Promise<boolean> {
  const bookings = await getBookings();
  const booking = bookings.find(b => b.id === id);
  if (!booking) return false;
  
  booking.status = 'cancelled';
  await saveBookings(bookings);
  
  // Gebe Kapazität zurück
  const slot = (await getTimeSlots()).find(s => s.id === booking.slotId);
  if (slot) {
    slot.available += booking.participants;
    await updateTimeSlot(slot.id, { available: slot.available });
  }
  
  return true;
}

