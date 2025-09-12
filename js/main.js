'use strict';

const gc_version = '5.1.0';
const gc_author = 'By Geir Ove Nesvik';
const gc_max_ticket_num = 99999;    // No ticket number can be larger than this number
const gc_tooManyTickets = 99999;    // A warning will be raised if the sum of tickets is greater than this number
const gc_reset_warning = 'This will end the current session and reset the app.';
const splashHTML = `
    <div id="splash-screen" class="w3-card-4 color-slate-teal splash-font">
        <div class="w3-display-middle">
        <div class="line1">Tombola</div>
        <div class="line2">Draw</div>
        </div>
    </div>`;
const gc_splashScreenImg =
        '<img id="splash-screen" src="images/tombola-splash-001.webp" alt="Splash screen" class="w3-card-4"></img>';
const gc_ticketColors = [
        'color-pale-blue', 'color-pale-green', 'color-pale-red', 'color-pale-yellow',
        'color-skybound-blue', 'color-meadow-mint', 'color-golden-hour-glow', 'color-tangerine-drift', 'color-rosewood-blush',
        'color-orange', 'color-purple', 'color-teal', 'color-burgundy',
        'color-bronze', 'color-silver', 'color-gold'
      ];

const err_TooFewTickets = 101;
const err_TicketNumberTooBig = 102;
const err_TooManyTickets = 103;
const err_OverlappingRanges = 104;
const err_NonIntegerNumberDetected = 105;
const io_delay = 150// ms

let gv_ticketFontSize = '48vmin';   // Standard font size for tickets
let gv_activeMode = 'input';        // Initial mode
let gv_drawHistory;
let gv_all_tickets; 
let gv_historyIndex;                // Index number for drawn tickets
let gv_overlaps;                    // List of overlapping rows. NaN indicates an incomplete record
let gv_grandTotal;
let gv_color_index;
let gv_countdown;

let slider = document.querySelector('#suspension-time');
let suspensionTime = slider.value;

/* Some helper functions */

function setText(selector, value, parent = document) {
  const el = parent.querySelector(selector);
  if (el) el.textContent = value;
}

function showElement(selector, displayType = 'block') {
    const el = document.querySelector(selector);
    if (el) el.style.display = displayType;
}

function hideElement(selector) {
    const el = document.querySelector(selector);
    if (el) el.style.display = 'none';
}

function enableElements(selector) {
    document.querySelectorAll(selector).forEach(el => el.disabled = false);
}

function disableElements(selector) {
    document.querySelectorAll(selector).forEach(el => el.disabled = true);
}

function copyComputedStyle(fromSelector, toSelector, property) {
    const toEl = document.querySelector(toSelector);
    const fromEl = document.querySelector(fromSelector);
    if (toEl && fromEl) {
        const value = getComputedStyle(fromEl)[property];
        toEl.style[property] = value;
    }
}

function toggleElement(condition, selector) {
    condition ? enableElements(selector) : disableElements(selector);
}

// initiate Tombola Draw

document.querySelector('#version').textContent = gc_version;
document.querySelector('#author').textContent = gc_author;
document.querySelector('#rangeValue').textContent = parseFloat(suspensionTime).toFixed(1);

resetApp();

/* Functions */

// Reveal winner 
function revealWinner () {
    document.querySelector('#present-winner').style.opacity = '0';
    hideElement('#spinner-panel');
    showElement('#present-winner', 'flex');

    copyComputedStyle('#ticket-text', '#menu-icon', 'color');

    const html = document.documentElement;
    const startVel = Math.min(html.clientHeight, html.clientWidth)/20;

    if (typeof confetti === "function") {
        // 🎉 Let the confetti fly!
        confetti({
            particleCount: 200,
            spread: 360,
            startVelocity: startVel,
            gravity: 0.8,
            ticks: 250,
            scalar: 1.8,
            drift: 0,
            decay: 0.92,
            colors: spinnerColors
        })        
    }    
    document.querySelector('#present-winner').style.opacity = '1';

}

// Set background color in registration form record
function nextColor () {
    gv_color_index++;
    gv_color_index = gv_color_index % 16;
    return gc_ticketColors[gv_color_index];
}

// Add a new record
function addNewRow () {

    const form_tab = document.querySelector('tbody');
    const first_row = form_tab.querySelector('tr');
    const new_row = first_row.cloneNode(true);
    const chosen_color = nextColor();
    const item_num = form_tab.querySelectorAll('tr').length+1;
   
    setText('.item-no', item_num, new_row);
    new_row.className = chosen_color;
    new_row.querySelector(`[title="color"] .${chosen_color}`).selected = true;
    new_row.querySelector('[title="first"]').value = 1;
    new_row.querySelector('[title="last"]').value = null;
    new_row.querySelector('.status-light').style.backgroundColor = 'orange';
    setText('.num-tickets', 0, new_row);

    form_tab.appendChild(new_row);

    // Scroll to bottom of the list
    new_row.scrollIntoView();
    
    gv_overlaps.push(new Set([NaN]));

}

// Check that all ticket series are valid
function checkOverlaps(element) {

    let all_rows = document.querySelectorAll('[aria-label="inputRecord"]');
    let cur_color;
    let cur_letter;
    let cur_row = element.srcElement.closest('tr');
    let cur_index = cur_row.rowIndex-1;
    let cur_first_val = Number(cur_row.querySelector('[title="first"]').value);
    let cur_last_val = Number(cur_row.querySelector('[title="last"]').value);
    let other_first_val;
    let other_last_val;

    if (cur_first_val <= 0 || cur_first_val > cur_last_val ) {

        // Current row is incomplete, remove existing overlaps
        gv_overlaps[cur_index].forEach((other_index) => {
            if (other_index >= 0) gv_overlaps[other_index].delete(cur_index);
        });

        gv_overlaps[cur_index].clear();
        gv_overlaps[cur_index].add(NaN);
    }
    else {

        all_rows.forEach((cur_elem, cur_index) => {

            cur_first_val = Number(cur_elem.querySelector('[title="first"]').value);
            cur_last_val = Number(cur_elem.querySelector('[title="last"]').value);
            
            if (cur_first_val <= 0 || cur_last_val < cur_first_val) return;

            if (gv_overlaps[cur_index]?.delete) {
                gv_overlaps[cur_index].delete(NaN);   // Data record is complete
            }

            cur_color = cur_elem.querySelector('[title="color"]').value;
            cur_letter = cur_elem.querySelector('[title="letter"]').value;

            for (let other = cur_index+1; other < all_rows.length && other < gv_overlaps.length; other++) {

                other_first_val = Number(all_rows[other].querySelector('[title="first"]').value);
                other_last_val = Number(all_rows[other].querySelector('[title="last"]').value);
               
                if (all_rows[other].querySelector('[title="color"]').value !== cur_color ||
                    all_rows[other].querySelector('[title="letter"]').value !== cur_letter ||
                    other_first_val > cur_last_val ||
                    other_last_val < cur_first_val ||
                    other_first_val <= 0 ||
                    other_last_val < other_first_val 
                ) {                      // No overlaps detected
                    gv_overlaps[other].delete(cur_index);
                    gv_overlaps[cur_index].delete(other);
                }
                else {                   // Overlaps detected!
                    gv_overlaps[other].add(cur_index);
                    gv_overlaps[cur_index].add(other);
                }
            }
        } )
    }

    setStatusLights();
}

// Calculate number and accumulated number of tickets
function countTickets(element) {

    const cur_row = element.srcElement.closest('[aria-label="inputRecord"]');
    const cur_first_elem = cur_row.querySelector('[title="first"]');
    const cur_last_elem = cur_row.querySelector('[title="last"]');

    console.debug(cur_first_elem); // Debug

    // Not complete row yet
    if (!cur_last_elem.value) return;

    if (!/^\d+$/.test(cur_first_elem.value+cur_last_elem.value)) {
        cur_first_elem.value = 1;
        cur_last_elem.value = "";
        raiseAlert(err_NonIntegerNumberDetected);
    }

    const cur_first_val = Number(cur_first_elem.value);
    const cur_last_val = Number(cur_last_elem.value);
    console.debug(`cur_first_val = ${cur_first_elem.value}, cur_last_val = ${cur_last_elem.value}`); // Debug
    const ticket_num = (cur_first_val > 0 && cur_last_val >= cur_first_val) ? cur_last_val - cur_first_val + 1 : 0;

    setText('.num-tickets', ticket_num, cur_row);

    gv_grandTotal = 0;
    document.querySelectorAll('.num-tickets').forEach((element) => {
         gv_grandTotal += Number(element.textContent)
    });

    // Raise error messages. These will also be checked before final registration.
    if (cur_last_val > gc_max_ticket_num) {
        // Ticket number is too big
        raiseAlert(err_TicketNumberTooBig);
        return;
    }

    if (gv_grandTotal > gc_tooManyTickets) {
        // Total number of tickets is too big
        raiseAlert(err_TooManyTickets);
        return;
    }

    setText('#totalNo', gv_grandTotal)

}

// Countdown function
function startCountdown(countdownPeriod) {

    const barFill = document.getElementById("barFill");

    // initiate the bar ...
    barFill.style.transition = `width ${countdownPeriod}s linear`;
    barFill.style.width = '100%';

    // and start the countdown
    setTimeout(() => {
        barFill.style.width = '0%';
    }, 80); // The delay ensures that the browser registers the initial state

}

// New draw
function drawTicket() {
    const colorField = 0;                 // Index for color part in array
    const labelField = 1;                 // Index for label part in array
    
    let nTicketsLeft = Object.keys(gv_all_tickets).length;

    gv_activeMode = 'draw';
    
    if (nTicketsLeft > 0) {
        
        startCountdown(suspensionTime);

        document.querySelector('#menu-icon').style.color = 'black';
        hideElement('#present-winner');
        (suspensionTime > 0) ? showElement('#spinner-panel', 'flex') : hideElement('#spinner-panel');

        const winner = Object.keys(gv_all_tickets)[Math.floor(Math.random() * nTicketsLeft)];
        gv_drawHistory.push(gv_all_tickets[winner]);
        setText('#logItem', gv_drawHistory.length);

        document.querySelector('#present-winner').opacity = 0;
        document.querySelector('#present-winner').className = gv_all_tickets[winner][colorField];
        setText('#ticket-text', gv_all_tickets[winner][labelField]);

        if (gv_drawHistory.length === 1) {
            // Set font size based on max length of ticket text
            document.querySelector('#ticket-text').style.fontSize = gv_ticketFontSize;
            hideElement('#regret');
            setText('#reset-warning', 'This will end the current session and reset the app.')
        }
        
        delete gv_all_tickets[winner];

        gv_historyIndex = gv_drawHistory.length - 1;

        gv_historyIndex ? enableElements('#prev') : disableElements('#prev');
        disableElements('#next');
        document.querySelector('#draw').style.opacity = nTicketsLeft > 1 ? 1 : 0.3;

        hideElement('#repetition');

        // Reveal winner when the spinner stops
        gv_countdown = setTimeout(revealWinner, suspensionTime*1000 + io_delay, '#ticket-text');

    }
}

// Start reviewing
function startReview() {

    if (document.querySelector('input').disabled == false) return;

    // stop spinner
    clearTimeout(gv_countdown);
    hideElement('#spinner-panel');

    // Switch page
    hideElement('#present-winner');
    document.querySelector('html').style.backgroundColor = 'beige';
   
    //// document.querySelector('#menu-icon').style.color = 'black';
    showElement('#registration');
    
    document.querySelectorAll('.button-set').forEach((element) => { element.style.display = 'none' });

    showElement('#close', 'inline-block');

}

// Help information
function showHelp() {
    // Mark the current mode in the Help screen
    highlightActiveMode(gv_activeMode);
    showElement('#help');
}

// Back to drawing
function endReview() {

    if (document.querySelector('#close').style.display == 'none') return;

    // Switch page
    document.querySelector('#registration').scrollTop = 0;
    hideElement('#registration');
    showElement('#present-winner', 'flex');
    
    document.querySelector('html').style.backgroundColor = 'whitesmoke';
    copyComputedStyle('#ticket-text', '#menu-icon', 'color');
    document.querySelectorAll('.button-set').forEach((element) => { element.style.display = 'inline-block' });

    hideElement('#close');

    if ( gv_drawHistory.length > 0 && gv_drawHistory.length > gv_historyIndex) {
        showElement('#repetition', 'flex');
        hideElement('#regret');
    }

    enableElements('#draw');
    (gv_historyIndex > 0) ? enableElements('#prev') : disableElements('#prev');
    (gv_drawHistory.length > gv_historyIndex+1) ? enableElements('#next') : disableElements('#next');

}

// Set the dislosure time i.e. the spinning time of the spinner
function setSuspensionTime() {

    suspensionTime = slider.value;
    // Closing modal page
    hideElement('#setSuspensionTime');

}

// Reset the dislosure time
function resetSuspensionTime() {

    document.querySelector('#suspension-time').value = suspensionTime;
    setText('#rangeValue', parseFloat(suspensionTime).toFixed(1));

    // Close page
    hideElement('#setSuspensionTime');

}

// Raise warning messages
function raiseAlert(message_no) {

    let err_message;

    switch(message_no) {
        case err_TooFewTickets:
          err_message = `Total number of tickets is too small. Minimum is 2.`;
          break;
        case err_TicketNumberTooBig:
          err_message = `Ticket number is too big. Maximum is ${gc_max_ticket_num}.`;
          break;
        case err_TooManyTickets:
          err_message = `Total number of tickets is too big. Maximum is ${gc_max_ticket_num}.`;
          break;
        case err_OverlappingRanges:
          err_message = "Two or more ticket ranges are overlapping.";
          break;
        case err_NonIntegerNumberDetected:
          err_message = "Only integers are allowed in number fields.";
          break;                  
        default:
          err_message = "Unexpected condition.";
    }

    document.querySelector("#alert-text").textContent = err_message;
    showElement('#alert');
}


// Register all the tickets
function registerTickets() {

    if (gv_drawHistory.length > 0) return;

    const inputTable = document.querySelector('table');
    const colors = inputTable.querySelectorAll('tr [title="color"]');
    const letters = inputTable.querySelectorAll('tr [title="letter"]');
    const firsts = inputTable.querySelectorAll('tr [title="first"]');
    const lasts = inputTable.querySelectorAll('tr [title="last"]');

    const noInputErrors = gv_overlaps.every(set => set.size === 0 || set.has(NaN));
    if (!noInputErrors) {
        return raiseAlert(err_OverlappingRanges); // Overlap alert
    }

    gv_all_tickets = {};
    let grandTotal = 0;
    let longestLabelLen = 1;

    for (let i = 0; i < inputTable.rows.length - 2; i++) {
        const color = colors[i]?.value;
        const letter = letters[i]?.value;
        const from = Number(firsts[i]?.value);
        const to = Number(lasts[i]?.value);

        if (!color || isNaN(from) || isNaN(to)) continue;

        if (to-from+grandTotal >= gc_tooManyTickets) return raiseAlert(err_TooManyTickets);

        for (let ticketNum = from; ticketNum <= to && ticketNum > 0; ticketNum++) {
            const label = letter >= 'A' ? `${letter} ${ticketNum}` : `${ticketNum}`;
            gv_all_tickets[grandTotal++] = [color, label];
            longestLabelLen = Math.max(label.length, longestLabelLen);
        }
    }

    if (grandTotal < 2) return raiseAlert(err_TooFewTickets); // Not enough tickets
    if (grandTotal > gc_tooManyTickets) return raiseAlert(err_TooManyTickets); // Too many tickets

    gv_grandTotal = grandTotal;
    gv_ticketFontSize = `${24 + (7 - longestLabelLen) * 4}vmin`;

    // UI updates
    disableElements('#registration input, [title="color"], [title="letter"]');
    document.querySelectorAll('.cancel-x').forEach(el => el.classList.remove("remove-item"));

    window.scrollTo(0, 0);
    showElement('#read-only', 'grid');
    document.querySelector('#review-button').style.opacity = '1';

    const selection = document.querySelector('#registration');
    selection.scrollTop = 0;
    selection.style.display = 'none';

    showElement('#present-winner', 'flex');
    enableElements('#draw');
    disableElements('#prev', '#next');

    document.querySelector('#ticketButtons.button-row').style.bottom = '0px';

    gv_activeMode = 'ready';
}

// Regret registration
function regretRegistration() {

    enableElements('input, .select-color, .select-letter');
    document.querySelectorAll('.cancel-x').forEach((element) => { element.classList.add("remove-item") });

    window.scrollTo(0, 0);

    // setText('#page-heading', 'REGISTER TICKETS');
    hideElement('#read-only');
    document.querySelector('#review-button').style.opacity = '0.3';
   
    let selection = document.querySelector('#registration');
    selection.scrollTop = 0;
    selection.style.display = 'block';

    // Switch page
    hideElement('#present-winner');
    
    disableElements('#draw');
    document.querySelectorAll('.button-set').forEach((element) => { element.style.bottom = '' });

    gv_activeMode = 'input';
    
}

// Remove an item
function deleteCurrentRow(element) {

    let selection = document.querySelectorAll('[aria-label="inputRecord"]');

    if (selection.length > 1) {
        
        const removed_item_idx = element.closest('tr').rowIndex-1;

        // Subtract the deleted number of tickets
        gv_grandTotal -= Number(selection[removed_item_idx].querySelector('.num-tickets').textContent);
        
        // Renumber the form items and adjust the sets of overlaps
        for (let i = 0; i < selection.length; i++) {
            if (i === removed_item_idx) continue;
           
            // Renumber the succeeding rows
            if (i > removed_item_idx) setText('.item-no', i, selection[i]);

            // Delete the removed item from the current set of overlaps
            gv_overlaps[i].delete(removed_item_idx);

            // Recalculate the overlaps
            for (let j of new Set(gv_overlaps[i])) {
                if (j <= removed_item_idx) continue;
                gv_overlaps[i].delete(j);
                gv_overlaps[i].add(j - 1);
            }
        }

        // Remove element and overlap array
        element.closest('tr').remove();
        gv_overlaps.splice(removed_item_idx, 1);

    }
    else {

        let colorClass = nextColor();
        selection[0].className = colorClass;
        selection[0].querySelector(`[title="color"] .${colorClass}`).selected = 'selected';
        selection[0].querySelector('[title="letter"]').value = '';
        selection[0].querySelector('[title="first"]').value = 1;
        selection[0].querySelector('[title="last"]').value = '';    
        setText('.num-tickets', 0, selection[0]);
        gv_overlaps = [new Set([NaN])];
        gv_grandTotal = 0;
    }

    setText('#totalNo', gv_grandTotal || 0);

    setStatusLights();

}

// Reset all data before registering new tickets
function resetApp() {

    gv_overlaps = [new Set([NaN])];
    gv_drawHistory = [];
    gv_all_tickets = {};
    gv_historyIndex = -1;
    gv_color_index = 15;
    gv_grandTotal = 0;

    // Stop spinner
    clearTimeout(gv_countdown);
    document.querySelector('html').style.backgroundColor = 'whitesmoke';
    hideElement('#spinner-panel');
     
    // Hide resetApp card
    hideElement('#reset');
    document.querySelectorAll('#reset button').forEach((element) => { element.style.width = '4em' });

    // Switch page
    showElement('#registration');
    hideElement('#present-winner');

    // setText('#page-heading', 'TICKET REGISTRATION');
    hideElement('#read-only');
    setText('#reset-warning', 'This will reset the app.')

    // Remove all but one items
    document.querySelectorAll('[aria-label="inputRecord"]').forEach((element, idx) => { if (idx > 0) element.remove(); });
    
    const select = document.getElementById("letterSelect");

    for (let i = 65; i <= 90; i++) {
        const letter = String.fromCharCode(i); // ASCII codes for A-Z
        const option = document.createElement("option");
        option.text = letter;
        select.add(option);
    }
        
    const colorClass = nextColor();
    document.querySelector('[aria-label="inputRecord"]').className = colorClass;
    document.querySelector(`[title="color"] .${colorClass}`).selected = 'selected';
    document.querySelector('[title="letter"]').value = '';
    document.querySelector('[title="first"]').value = 1;
    document.querySelector('[title="last"]').value = '';    
    setText('.num-tickets', 0);
        
    // Make inputs editable
    enableElements('input, #insert, .select-color, .select-letter');
    disableElements('#prev, #next');
        
    hideElement('#repetition');
    document.querySelector('#present-winner').removeAttribute('class');
    // document.querySelector('#ticket-text').innerHTML = gc_splashScreenImg;
    document.querySelector('#ticket-text').innerHTML = splashHTML;
    setText('#logItem', ' ');
    setText('#totalNo', 0);
    document.querySelector('#review-button').style.opacity = '0.3';
    hideElement('#regret');

    document.querySelector('.status-light').style.backgroundColor = 'Orange';
    document.querySelector('.num-tickets').textContent = '0';

    document.querySelectorAll('.cancel-x').forEach((element) => { element.classList.add('remove-item') });
    document.querySelectorAll('.button-set').forEach((element) => { element.style.display = 'inline-block' });
    document.querySelectorAll('.button-set').forEach((element) => { element.style.bottom = '' });

    hideElement('#close');

    gv_activeMode = 'input';

}

// Set correct status light
function setStatusLights() {
    let statusColor;

    gv_overlaps.forEach((row, i) => {
        statusColor = 'green';
        if (row.size > 0) statusColor = 'red';
        if (row.has(NaN)) statusColor = 'orange';
        
        document.querySelectorAll('[aria-label="inputRecord"] .status-light')[i].style.backgroundColor = statusColor;    
    });

}

// Show a previous winner ticket when requested
function traverseHistory(incr) {

    if (incr < 0 && gv_historyIndex == 0) return;
    if (incr > 0 && gv_historyIndex == gv_drawHistory.length-1) return;
    
    gv_historyIndex += incr;

    // Activate or deactivate the 'Previous' button
    document.querySelector('#prev').disabled = (gv_historyIndex == 0) ? true : false;

    // Activate or deactivate the 'Next' button
    document.querySelector('#next').disabled = (gv_historyIndex == gv_drawHistory.length - 1) ? true : false;
    
    document.querySelector('#present-winner').className = gv_drawHistory[gv_historyIndex][0];

    // Show a big R to remind the user that this is a repetition
    showElement('#repetition', 'flex');
    setText('#ticket-text', gv_drawHistory[gv_historyIndex][1]);

    setText('#logItem', gv_historyIndex + 1);
    copyComputedStyle('#ticket-text', '#menu-icon' ,'color');
    
}

// Events
slider.oninput = function() {
    setText('#slider', this.value);
    document.querySelector('#rangeValue').textContent = parseFloat(slider.value).toFixed(1);
}

document.querySelector('tbody').addEventListener('change', evalRegistationEvent);
document.querySelector('tbody').addEventListener('click', evalRegistationEvent);
document.querySelector('#registrationButtons').addEventListener('click', evalRegistationButtonEvent);
document.querySelector('#ticketButtons').addEventListener('click', evalDrawingEvents);
document.addEventListener('click', evalModalEvent);
document.addEventListener('keyup', evalShortcut, true);

// The debounce function assures smooth performance and reduce redundant calculations as somebody types
function debounce(func, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

// Evaluate events
function evalRegistationEvent(event) {

    if (event.type === 'click') {
        if (event.target.classList.contains('remove-item')) {
            // Delete the entire row
            deleteCurrentRow(event.target);
            event.stopPropagation();
        }
        return;
    }

    const row = event.target.closest('tr');
    if (!row) return; // Defensive check

    if (event.target.classList.contains('select-color')) {
        row.className = event.target.value;
        checkOverlaps(event);

        gv_color_index = gc_ticketColors.indexOf(row.className);
        return;
    }
    
    if (event.target.classList.contains('select-letter')) {
        checkOverlaps(event);
        return;
    }

    if (event.target.classList.contains('ticket-number')) {
        debounce(countTickets)(event);
        debounce(checkOverlaps)(event);
        return;
    }

}

function evalRegistationButtonEvent(event) {

    switch (event.target.id) {
        case 'insert':
            addNewRow();
            break;
        case 'ready':
            registerTickets();
            break;
        case 'close':
            endReview();
            break;

    }

    event.stopPropagation();
}

function evalModalEvent(event) {

    if (event.target.id == 'setSuspensionTime') {
        resetSuspensionTime();
        return;
    }

    if (event.target.classList.contains('w3-modal')) {
        event.target.style.display = 'none';
        return;
    }
}

function evalDrawingEvents(event) {
    switch (event.target.id) {
        case 'draw':
            drawTicket();
            break;
        case 'next':
            traverseHistory(1);
            break;
        case 'prev':
            traverseHistory(-1);
            break;
        case 'regret':
            regretRegistration();
            break;
    }

    event.stopPropagation();     
}

// Highlight active mode on Help screen
function highlightActiveMode(currentMode) {
    const modeHeadings = {
        input: 'mode-input',
        ready: 'mode-ready',
        draw : 'mode-draw'
    };

    // Clear all highlights from headings
    Object.values(modeHeadings).forEach(id => {
        const heading = document.getElementById(id);
        if (heading) {
            heading.textContent = heading.textContent.replace(/ ★/, '');
        }
    });

    // Highlight the active heading
    const activeId = modeHeadings[currentMode];
    const activeHeading = document.getElementById(activeId);
    if (activeHeading && !activeHeading.textContent.match(/★$/)) {
        activeHeading.textContent += ' ★';
    }
}

// Key events
function evalShortcut(event) {

    // Resetting mode
    if (document.querySelector('#reset').style.display == 'block') {
        switch (event.key) {
            case 'N': {
                hideElement('#reset');
                break;
            } 
            case 'Y': {
                resetApp();
                break;
            }
        }
        return;
    }

    // Registration mode
    if (document.querySelector('#read-only').style.display == 'none') {
        switch (event.key) {
            case 'PageDown': { // ready
                registerTickets();
                break;
            }    
            case 'Insert': { // insert new row
                addNewRow();
                break;
            }
        }
        return;
    }

    // Drawing mode
    if (document.querySelector('#present-winner').style.display == 'flex') {
        switch (event.key) {
            case 'Enter': // draw
            case ' ': {
                drawTicket();
                break;
            }
            case 'PageUp': { // regret
                if (gv_drawHistory.length === 0)
                    regretRegistration();
                else
                    startReview();
                break;
            }        
            case 'PageDown': { // ready
                registerTickets();
                break;
            }          
            case 'ArrowLeft': { // prev
                traverseHistory(-1);
                break;
            } 
            
            case 'ArrowRight': { // next
                traverseHistory(1);
                break;
            }
        }
        return;
    }

    // Review mode
    if (document.querySelector('#read-only').style.display == 'grid') {
        if (event.key == 'PageDown') { // <PageDown>
            endReview();  // close
        }
        return;
    }
}    

function rgbToHex(rgb) {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

const spinnerColors = Array.from(
    document.querySelectorAll('.card')).map(el => {
        return rgbToHex(window.getComputedStyle(el).backgroundColor);
    }
);

console.debug(spinnerColors);

/* ─── Register ServiceWorker ─── */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('js/sw.js')
            .then(ref => console.log('✅ Service worker registered'))
            .catch(err => console.log(`❌ Service worker failed: ${err}`))
    });
}
