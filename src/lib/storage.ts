import fs from 'fs/promises';
import path from 'path';
import { isS3Configured, readJsonFromS3, writeJsonToS3 } from './s3-storage';

const DATA_DIR = path.join(process.cwd(), 'data');

// Dateinamen für S3 und lokales Dateisystem
const SLOTS_FILENAME = 'time-slots.json';
const BOOKINGS_FILENAME = 'bookings.json';
const WORKSHOPS_FILENAME = 'workshops.json';
const CATEGORIES_FILENAME = 'gallery-categories.json';
const IMAGE_METADATA_FILENAME = 'image-metadata.json';

// Lokale Pfade (Fallback)
const SLOTS_FILE = path.join(DATA_DIR, SLOTS_FILENAME);
const BOOKINGS_FILE = path.join(DATA_DIR, BOOKINGS_FILENAME);
const WORKSHOPS_FILE = path.join(DATA_DIR, WORKSHOPS_FILENAME);
const CATEGORIES_FILE = path.join(DATA_DIR, CATEGORIES_FILENAME);
const IMAGE_METADATA_FILE = path.join(DATA_DIR, IMAGE_METADATA_FILENAME);

// Event-Typen für Termine
export type EventType = 'normal' | 'kindergeburtstag' | 'stammtisch';

export interface TimeSlot {
	id: string;
	date: string; // YYYY-MM-DD
	time: string; // HH:MM (Startzeit)
	endTime?: string; // HH:MM (Endzeit, optional)
	maxCapacity: number;
	available: number;
	createdAt: string;
	eventType?: EventType; // Art des Events (normal, kindergeburtstag, stammtisch)
	eventDuration?: number; // Dauer in Stunden (z.B. 3 für 3 Stunden)
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

export interface Workshop {
  id: string;
  title: string;
  description: string;
  detailedDescription?: string; // Ausführliche Beschreibung für Hauptseite/Modal
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  price: string; // z.B. "45€" oder "45€ pro Person"
  maxParticipants: number;
  currentParticipants?: number; // Anzahl der aktuellen Buchungen
  active: boolean; // Nur aktive Workshops werden auf der Hauptseite angezeigt
  imageFilename?: string; // Optionales Titelbild aus der Galerie
  createdAt: string;
}

export interface GalleryCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface ImageMetadata {
  filename: string;
  categories: string[]; // Array von Kategorie-IDs
  uploadedAt: string;
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
  if (isS3Configured()) {
    return await readJsonFromS3<TimeSlot[]>(SLOTS_FILENAME, []);
  }
  await ensureDataDir();
  await ensureFile(SLOTS_FILE, []);
  const data = await fs.readFile(SLOTS_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function saveTimeSlots(slots: TimeSlot[]): Promise<void> {
  if (isS3Configured()) {
    await writeJsonToS3(SLOTS_FILENAME, slots);
    return;
  }
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
  if (isS3Configured()) {
    return await readJsonFromS3<Booking[]>(BOOKINGS_FILENAME, []);
  }
  await ensureDataDir();
  await ensureFile(BOOKINGS_FILE, []);
  const data = await fs.readFile(BOOKINGS_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function saveBookings(bookings: Booking[]): Promise<void> {
  if (isS3Configured()) {
    await writeJsonToS3(BOOKINGS_FILENAME, bookings);
    return;
  }
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
	    // Neue Buchungen starten als "neu/unbestätigt" und können im Admin-Panel bestätigt werden
	    status: 'pending',
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

	// Allgemeine Aktualisierung einer Buchung (z.B. Teilnehmerzahl, Notizen, Status)
	// Hinweis: Status "cancelled" wird weiterhin ausschließlich über cancelBooking gesetzt,
	// damit die Kapazitätslogik zentral bleibt.
	export async function updateBooking(
	  id: string,
	  updates: Partial<Omit<Booking, 'id' | 'slotId' | 'createdAt'>>
	): Promise<Booking | null> {
	  // Verhindere, dass Stornierungen über diese Funktion laufen
	  if ('status' in updates && updates.status === 'cancelled') {
	    throw new Error('USE_CANCEL_BOOKING');
	  }

	  const bookings = await getBookings();
	  const index = bookings.findIndex((b) => b.id === id);
	  if (index === -1) return null;

	  const current = bookings[index];

	  // Wenn sich die Teilnehmerzahl ändert, muss die Slot-Kapazität angepasst werden
	  if (
	    typeof updates.participants === 'number' &&
	    updates.participants !== current.participants
	  ) {
	    if (updates.participants <= 0) {
	      throw new Error('INVALID_PARTICIPANTS');
	    }

	    const slots = await getTimeSlots();
	    const slot = slots.find((s) => s.id === current.slotId);
	    if (!slot) return null;

	    const delta = updates.participants - current.participants;
	    const newAvailable = slot.available - delta;

	    if (newAvailable < 0) {
	      throw new Error('NOT_ENOUGH_CAPACITY');
	    }

	    await updateTimeSlot(slot.id, { available: newAvailable });
	  }

	  const updated: Booking = {
	    ...current,
	    ...updates,
	  };

	  bookings[index] = updated;
	  await saveBookings(bookings);
	  return updated;
	}

// Workshops
export async function getWorkshops(): Promise<Workshop[]> {
  if (isS3Configured()) {
    return await readJsonFromS3<Workshop[]>(WORKSHOPS_FILENAME, []);
  }
  await ensureDataDir();
  await ensureFile(WORKSHOPS_FILE, []);
  const data = await fs.readFile(WORKSHOPS_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function saveWorkshops(workshops: Workshop[]): Promise<void> {
  if (isS3Configured()) {
    await writeJsonToS3(WORKSHOPS_FILENAME, workshops);
    return;
  }
  await ensureDataDir();
  await fs.writeFile(WORKSHOPS_FILE, JSON.stringify(workshops, null, 2));
}

export async function addWorkshop(workshop: Omit<Workshop, 'id' | 'createdAt'>): Promise<Workshop> {
  const workshops = await getWorkshops();
  const newWorkshop: Workshop = {
    ...workshop,
    id: `workshop_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    createdAt: new Date().toISOString(),
  };
  workshops.push(newWorkshop);
  await saveWorkshops(workshops);
  return newWorkshop;
}

export async function updateWorkshop(id: string, updates: Partial<Workshop>): Promise<Workshop | null> {
  const workshops = await getWorkshops();
  const index = workshops.findIndex(w => w.id === id);
  if (index === -1) return null;

  const updated: Workshop = {
    ...workshops[index],
    ...updates,
  };

  workshops[index] = updated;
  await saveWorkshops(workshops);
  return updated;
}

export async function deleteWorkshop(id: string): Promise<boolean> {
  const workshops = await getWorkshops();
  const filtered = workshops.filter(w => w.id !== id);
  if (filtered.length === workshops.length) return false;
  await saveWorkshops(filtered);
  return true;
}

// Gallery Categories
export async function getCategories(): Promise<GalleryCategory[]> {
  if (isS3Configured()) {
    return await readJsonFromS3<GalleryCategory[]>(CATEGORIES_FILENAME, []);
  }
  await ensureDataDir();
  await ensureFile(CATEGORIES_FILE, []);
  const data = await fs.readFile(CATEGORIES_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function saveCategories(categories: GalleryCategory[]): Promise<void> {
  if (isS3Configured()) {
    await writeJsonToS3(CATEGORIES_FILENAME, categories);
    return;
  }
  await ensureDataDir();
  await fs.writeFile(CATEGORIES_FILE, JSON.stringify(categories, null, 2));
}

export async function addCategory(name: string): Promise<GalleryCategory> {
  const categories = await getCategories();

  // Prüfe ob Name bereits existiert
  if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('CATEGORY_EXISTS');
  }

  const newCategory: GalleryCategory = {
    id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    name,
    createdAt: new Date().toISOString(),
  };

  categories.push(newCategory);
  await saveCategories(categories);
  return newCategory;
}

export async function renameCategory(id: string, newName: string): Promise<GalleryCategory | null> {
  const categories = await getCategories();
  const index = categories.findIndex(c => c.id === id);
  if (index === -1) return null;

  // Prüfe ob neuer Name bereits existiert (außer bei gleicher Kategorie)
  if (categories.some(c => c.id !== id && c.name.toLowerCase() === newName.toLowerCase())) {
    throw new Error('CATEGORY_EXISTS');
  }

  categories[index].name = newName;
  await saveCategories(categories);
  return categories[index];
}

export async function deleteCategory(id: string): Promise<boolean> {
  const categories = await getCategories();
  const filtered = categories.filter(c => c.id !== id);
  if (filtered.length === categories.length) return false;

  // Entferne Kategorie auch aus allen Bild-Metadaten
  const metadata = await getImageMetadata();
  const updatedMetadata = metadata.map(m => ({
    ...m,
    categories: m.categories.filter(catId => catId !== id)
  }));
  await saveImageMetadata(updatedMetadata);

  await saveCategories(filtered);
  return true;
}

// Image Metadata
export async function getImageMetadata(): Promise<ImageMetadata[]> {
  if (isS3Configured()) {
    return await readJsonFromS3<ImageMetadata[]>(IMAGE_METADATA_FILENAME, []);
  }
  await ensureDataDir();
  await ensureFile(IMAGE_METADATA_FILE, []);
  const data = await fs.readFile(IMAGE_METADATA_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function saveImageMetadata(metadata: ImageMetadata[]): Promise<void> {
  if (isS3Configured()) {
    await writeJsonToS3(IMAGE_METADATA_FILENAME, metadata);
    return;
  }
  await ensureDataDir();
  await fs.writeFile(IMAGE_METADATA_FILE, JSON.stringify(metadata, null, 2));
}

export async function getImageMetadataByFilename(filename: string): Promise<ImageMetadata | null> {
  const metadata = await getImageMetadata();
  return metadata.find(m => m.filename === filename) || null;
}

export async function setImageCategories(filename: string, categoryIds: string[]): Promise<ImageMetadata> {
  const metadata = await getImageMetadata();
  const index = metadata.findIndex(m => m.filename === filename);

  if (index === -1) {
    // Erstelle neuen Eintrag
    const newMetadata: ImageMetadata = {
      filename,
      categories: categoryIds,
      uploadedAt: new Date().toISOString(),
    };
    metadata.push(newMetadata);
    await saveImageMetadata(metadata);
    return newMetadata;
  } else {
    // Aktualisiere bestehenden Eintrag
    metadata[index].categories = categoryIds;
    await saveImageMetadata(metadata);
    return metadata[index];
  }
}

export async function addImageToCategory(filename: string, categoryId: string): Promise<ImageMetadata> {
  const metadata = await getImageMetadata();
  const index = metadata.findIndex(m => m.filename === filename);

  if (index === -1) {
    // Erstelle neuen Eintrag
    const newMetadata: ImageMetadata = {
      filename,
      categories: [categoryId],
      uploadedAt: new Date().toISOString(),
    };
    metadata.push(newMetadata);
    await saveImageMetadata(metadata);
    return newMetadata;
  } else {
    // Füge Kategorie hinzu, falls noch nicht vorhanden
    if (!metadata[index].categories.includes(categoryId)) {
      metadata[index].categories.push(categoryId);
      await saveImageMetadata(metadata);
    }
    return metadata[index];
  }
}

export async function removeImageFromCategory(filename: string, categoryId: string): Promise<ImageMetadata | null> {
  const metadata = await getImageMetadata();
  const index = metadata.findIndex(m => m.filename === filename);

  if (index === -1) return null;

  metadata[index].categories = metadata[index].categories.filter(id => id !== categoryId);
  await saveImageMetadata(metadata);
  return metadata[index];
}
