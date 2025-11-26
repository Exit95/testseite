/**
 * BookingCalendar - Moderner, universell einsetzbarer Buchungskalender
 * @version 1.0.0
 */

class BookingCalendar {
    constructor(selector, options = {}) {
        this.container = document.querySelector(selector);
        if (!this.container) {
            throw new Error(`Element ${selector} nicht gefunden`);
        }

        // Default-Konfiguration
        this.config = {
            locale: options.locale || 'de',
            firstDayOfWeek: options.firstDayOfWeek || 1, // 0 = Sonntag, 1 = Montag
            minDate: options.minDate || new Date(),
            maxDate: options.maxDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            timeSlots: {
                enabled: options.timeSlots?.enabled !== false,
                start: options.timeSlots?.start || '09:00',
                end: options.timeSlots?.end || '17:00',
                duration: options.timeSlots?.duration || 60,
                break: options.timeSlots?.break || null
            },
            blockedDates: options.blockedDates || [],
            blockedWeekdays: options.blockedWeekdays || [],
            bookedSlots: options.bookedSlots || [],
            maxCapacityPerSlot: options.maxCapacityPerSlot || 15,
            onDateSelect: options.onDateSelect || null,
            onTimeSlotSelect: options.onTimeSlotSelect || null
        };

        // State
        this.currentDate = new Date();
        this.selectedDate = null;
        this.selectedTimeSlot = null;
        this.slotsCapacity = {}; // Speichert Kapazitätsinformationen

        // Initialisierung
        this.init();
    }

    init() {
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="calendar-header">
                <h2>Termin wählen</h2>
                <div class="calendar-nav">
                    <button id="prevMonth" aria-label="Vorheriger Monat">‹</button>
                    <div class="calendar-month-year" id="monthYear"></div>
                    <button id="nextMonth" aria-label="Nächster Monat">›</button>
                </div>
            </div>
            <div class="calendar-grid" id="calendarGrid"></div>
            <div class="time-slots-container" id="timeSlotsContainer" style="display: none;">
                <div class="time-slots-header">Verfügbare Zeiten</div>
                <div class="time-slots-grid" id="timeSlotsGrid"></div>
            </div>
        `;

        this.renderCalendar();
        this.attachEventListeners();
    }

    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();

        // Monat und Jahr anzeigen
        const monthYearElement = this.container.querySelector('#monthYear');
        monthYearElement.textContent = this.formatMonthYear(year, month);

        // Kalender-Grid
        const grid = this.container.querySelector('#calendarGrid');
        grid.innerHTML = '';

        // Wochentage
        const weekdays = this.getWeekdayNames();
        weekdays.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-weekday';
            dayElement.textContent = day;
            grid.appendChild(dayElement);
        });

        // Tage des Monats
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const prevLastDay = new Date(year, month, 0);

        // Berechne Start-Tag (berücksichtige firstDayOfWeek)
        let startDay = firstDay.getDay() - this.config.firstDayOfWeek;
        if (startDay < 0) startDay += 7;

        // Vorherige Monatstage
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevLastDay.getDate() - i;
            const date = new Date(year, month - 1, day);
            grid.appendChild(this.createDayElement(date, true));
        }

        // Aktuelle Monatstage
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            grid.appendChild(this.createDayElement(date, false));
        }

        // Nächste Monatstage (auffüllen)
        const remainingCells = 42 - grid.children.length + 7; // 7 für Wochentage
        for (let day = 1; day <= remainingCells; day++) {
            const date = new Date(year, month + 1, day);
            grid.appendChild(this.createDayElement(date, true));
        }
    }

    createDayElement(date, otherMonth) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = date.getDate();
        dayElement.dataset.date = date.toISOString();

        if (otherMonth) {
            dayElement.classList.add('other-month');
        }

        // Heute markieren
        if (this.isToday(date)) {
            dayElement.classList.add('today');
        }

        // Ausgewähltes Datum markieren
        if (this.selectedDate && this.isSameDay(date, this.selectedDate)) {
            dayElement.classList.add('selected');
        }

        // Deaktivierte Tage
        if (this.isDateDisabled(date)) {
            dayElement.classList.add('disabled');
        } else if (this.isDateBlocked(date)) {
            dayElement.classList.add('blocked');
        } else if (!otherMonth) {
            dayElement.addEventListener('click', () => this.selectDate(date));
        }

        return dayElement;
    }

    selectDate(date) {
        this.selectedDate = date;
        this.selectedTimeSlot = null;

        // Kalender neu rendern
        this.renderCalendar();

        // Zeitslots anzeigen, wenn aktiviert
        if (this.config.timeSlots.enabled) {
            this.renderTimeSlots();
        } else if (this.config.onDateSelect) {
            this.config.onDateSelect(date, null);
        }
    }

    renderTimeSlots() {
        const container = this.container.querySelector('#timeSlotsContainer');
        const grid = this.container.querySelector('#timeSlotsGrid');

        container.style.display = 'block';
        grid.innerHTML = '';

        const slots = this.generateTimeSlots();

        slots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = 'time-slot';

            // Zeitslot-Inhalt mit Kapazitätsanzeige
            const timeText = document.createElement('div');
            timeText.className = 'time-slot-time';
	            const label = slot.endTime ? `${slot.time} - ${slot.endTime} Uhr` : `${slot.time} Uhr`;
	            timeText.textContent = label;
            slotElement.appendChild(timeText);

            // Kapazitätsanzeige hinzufügen
            if (slot.capacity) {
                const capacityText = document.createElement('div');
                capacityText.className = 'time-slot-capacity';
                capacityText.textContent = `${slot.capacity.available}/${slot.capacity.maxCapacity} frei`;

                if (slot.capacity.available === 0) {
                    capacityText.classList.add('full');
                } else if (slot.capacity.available <= 3) {
                    capacityText.classList.add('low');
                }

                slotElement.appendChild(capacityText);
            }

	            if (slot.booked || (slot.capacity && slot.capacity.available === 0)) {
                slotElement.classList.add('booked');
                slotElement.title = 'Ausgebucht';
            } else if (slot.disabled) {
                slotElement.classList.add('disabled');
            } else {
                slotElement.addEventListener('click', () => this.selectTimeSlot(slot.time));
            }

            grid.appendChild(slotElement);
        });
    }

    generateTimeSlots() {
        const slots = [];

        // Nutze NUR Admin-erstellte Slots - kein Fallback!
        if (!this.config.bookedSlots || this.config.bookedSlots.length === 0) {
            // Keine Termine verfügbar
            return slots;
        }

	        const selectedDateStr = this.formatDateToString(this.selectedDate);

        // Filtere Slots für das ausgewählte Datum
        const slotsForDate = this.config.bookedSlots.filter(slot => {
            return slot.date === selectedDateStr;
        });

	        // Konvertiere in das erwartete Format
	        slotsForDate.forEach(slot => {
            const key = `${slot.date}|${slot.time}`;
            const capacity = this.slotsCapacity[key] || {
                available: slot.available || 0,
                maxCapacity: slot.maxCapacity || 15,
                booked: slot.booked || 0
            };

	            slots.push({
	                time: slot.time,
	                endTime: slot.endTime,
	                booked: capacity.available === 0,
	                disabled: false,
	                capacity: capacity,
	                slotId: slot.slotId
	            });
        });

        // Sortiere nach Zeit
        slots.sort((a, b) => {
            const [aHour, aMin] = a.time.split(':').map(Number);
            const [bHour, bMin] = b.time.split(':').map(Number);
            return (aHour * 60 + aMin) - (bHour * 60 + bMin);
        });

        return slots;
    }

    selectTimeSlot(timeSlot) {
        this.selectedTimeSlot = timeSlot;

        // Alle Zeitslots aktualisieren
        const slots = this.container.querySelectorAll('.time-slot');
        slots.forEach(slot => {
            slot.classList.remove('selected');
            if (slot.textContent === timeSlot) {
                slot.classList.add('selected');
            }
        });

        // Callback aufrufen
        if (this.config.onDateSelect) {
            this.config.onDateSelect(this.selectedDate, timeSlot);
        }
    }

    attachEventListeners() {
        const prevButton = this.container.querySelector('#prevMonth');
        const nextButton = this.container.querySelector('#nextMonth');

        prevButton.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendar();
            this.hideTimeSlots();
        });

        nextButton.addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendar();
            this.hideTimeSlots();
        });
    }

    hideTimeSlots() {
        const container = this.container.querySelector('#timeSlotsContainer');
        container.style.display = 'none';
    }

    // Hilfsfunktionen
    isToday(date) {
        const today = new Date();
        return this.isSameDay(date, today);
    }

    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }

    formatDateToString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    isDateDisabled(date) {
        // Vor minDate oder nach maxDate
        if (date < this.config.minDate || date > this.config.maxDate) {
            return true;
        }

        // Blockierte Wochentage
        if (this.config.blockedWeekdays.includes(date.getDay())) {
            return true;
        }

        // NUR Admin-Termine erlauben - wenn keine Slots vorhanden, alle Tage deaktivieren
        if (!this.config.bookedSlots || this.config.bookedSlots.length === 0) {
            return true; // Keine Termine verfügbar
        }

        // Prüfe ob es Slots für dieses Datum gibt
        const dateStr = this.formatDateToString(date);
        const hasSlots = this.config.bookedSlots.some(slot => slot.date === dateStr);
        if (!hasSlots) {
            return true; // Kein Termin für dieses Datum
        }

        return false;
    }

    isDateBlocked(date) {
        // Blockierte Daten
        return this.config.blockedDates.some(blockedDate => {
            const blocked = new Date(blockedDate);
            return this.isSameDay(date, blocked);
        });
    }

    isTimeSlotBooked(date, timeSlot) {
        return this.config.bookedSlots.some(slot => {
            const slotDate = new Date(slot.date);
            return this.isSameDay(date, slotDate) && slot.time === timeSlot;
        });
    }

    getWeekdayNames() {
        const baseWeekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        const rotated = [];

        for (let i = 0; i < 7; i++) {
            const index = (this.config.firstDayOfWeek + i) % 7;
            rotated.push(baseWeekdays[index]);
        }

        return rotated;
    }

    formatMonthYear(year, month) {
        const date = new Date(year, month, 1);
        return date.toLocaleDateString(this.config.locale, {
            month: 'long',
            year: 'numeric'
        });
    }

    formatTime(date) {
        return date.toLocaleTimeString(this.config.locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    formatDateForAPI(date) {
        return date.toLocaleDateString(this.config.locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Öffentliche Methoden
    refresh() {
        this.selectedDate = null;
        this.selectedTimeSlot = null;
        this.renderCalendar();
        this.hideTimeSlots();
    }

    setBookedSlots(bookedSlots) {
        this.config.bookedSlots = bookedSlots;

        // Kapazitätsinformationen extrahieren und speichern
        this.slotsCapacity = {};
        bookedSlots.forEach(slot => {
            const key = `${slot.date}|${slot.time}`;
            this.slotsCapacity[key] = {
                booked: slot.booked || 0,
                available: slot.available !== undefined ? slot.available : this.config.maxCapacityPerSlot,
                maxCapacity: slot.maxCapacity || this.config.maxCapacityPerSlot,
                isFull: slot.isFull || false
            };
        });

        if (this.selectedDate && this.config.timeSlots.enabled) {
            this.renderTimeSlots();
        }
    }

    addBookedSlot(date, time) {
        this.config.bookedSlots.push({ date, time });
        if (this.selectedDate && this.config.timeSlots.enabled) {
            this.renderTimeSlots();
        }
    }

    blockDate(date) {
        this.config.blockedDates.push(date);
        this.renderCalendar();
    }

    unblockDate(date) {
        this.config.blockedDates = this.config.blockedDates.filter(d => {
            const blocked = new Date(d);
            return !this.isSameDay(blocked, new Date(date));
        });
        this.renderCalendar();
    }

    getSelectedDate() {
        return this.selectedDate;
    }

    getSelectedTimeSlot() {
        return this.selectedTimeSlot;
    }

    destroy() {
        this.container.innerHTML = '';
    }
}

// Export für Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BookingCalendar;
}

