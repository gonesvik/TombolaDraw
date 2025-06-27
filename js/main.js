'use strict';

const gc_version = '5.0.2';
const gc_author = 'By Geir Ove Nesvik';
const gc_max_ticket_num = 99999;    // No ticket number can be larger than this number
const gc_tooManyTickets = 99999;    // A warning will be raised if the sum of tickets is greater than this number
const gc_splashScreenImg =
        '<img id="splash-screen" src="images/tombola-splash-001.webp" alt="Splash screen" class="w3-card-4"></img>';
const gc_colorClasses = [
        'color-pale-blue', 'color-pale-green', 'color-pale-red', 'color-pale-yellow',
        'color-bright-blue', 'color-bright-green', 'color-bright-red', 'color-bright-yellow',
        'color-grey', 'color-orange', 'color-purple', 'color-teal',
        'color-bronze', 'color-gold', 'color-paper', 'color-wood'
      ];
const cards = document.querySelectorAll('.card');
const seenAtZ0 = new Set();      

let gv_ticketFontSize = '48vmin';   // Standard font size for tickets
let gv_drawHistory;
let gv_all_tickets;
let gv_historyIndex;                // Index number for drawn tickets
let gv_overlaps;                    // List of overlapping rows. NaN indicates an incomplete record
let gv_grandTotal;
let gv_color_index;
let gv_countdown;

let slider = document.querySelector('#disclosure-time');
let disclosureTime = slider.value;

// Register ServiceWorker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('js/sw.js')
            .then(ref => console.log('Service worker registered'))
            .catch(err => console.log(`Service worker failed with ${err}`))
    })
}

// initiate Tombola Draw

document.querySelector('#version').textContent = gc_version;
document.querySelector('#author').textContent = gc_author;
document.querySelector('#rangeValue').textContent = parseFloat(disclosureTime).toFixed(1);

resetApp();

/* Functions */

// Reveal winner 
function revealWinner (elem) {
    document.querySelector('#winner-ticket').style.display = 'flex';
    document.querySelector('#spinner-panel').style.display = 'none';
    document.querySelector('#menu-icon').style.color = getComputedStyle(elem).color;
}

// Set background color in registration form record
function nextColor () {
    gv_color_index = ++gv_color_index % 16;
    return gc_colorClasses[gv_color_index];
}

// Add a new record
function addRecord () {

    let form_tab = document.querySelector('tbody');
    let first_row = form_tab.querySelector('tr');
    let new_row = first_row.cloneNode(true);

    let colorClass = nextColor();
    new_row.className = colorClass;
    new_row.querySelector('.item-no').textContent = form_tab.querySelectorAll('tr').length+1;
    new_row.querySelector(`[title="color"] .${colorClass}`).selected = 'selected';
    new_row.querySelector('[title="first"]').value = '1';
    new_row.querySelector('[title="last"]').value = null;
    new_row.querySelector('.status-light').style.backgroundColor = 'orange';
    new_row.querySelector('.num-tickets').textContent = '0';
    form_tab.appendChild(new_row);

    // Scroll to bottom of list
    new_row.scrollIntoView();
    
    gv_overlaps.push(new Set([NaN]));

}

// Check overlapping series of tickets
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

    if (!Number.isInteger(cur_first_val) || !Number.isInteger(cur_last_val)
       || cur_first_val <= 0 || cur_first_val > cur_last_val ) {

        // Current row is incomplete, remove existing overlaps
        gv_overlaps[cur_index].forEach((other_index) => {
            if (other_index >= 0) gv_overlaps[other_index].delete(cur_index);
        });

        gv_overlaps[cur_index].clear;
        gv_overlaps[cur_index].add(NaN);
    }
    else {

        all_rows.forEach((cur_elem, cur_index) => {

            cur_first_val = Number(cur_elem.querySelector('[title="first"]').value);
            cur_last_val = Number(cur_elem.querySelector('[title="last"]').value);
            
            if (cur_first_val <= 0 || cur_last_val < cur_first_val) return;

            gv_overlaps[cur_index].delete(NaN);  // Data record is complete

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

    let cur_row = element.srcElement.closest('[aria-label="inputRecord"]');
    let cur_first_val = Number(cur_row.querySelector('[title="first"]').value);
    let cur_last_val = Number(cur_row.querySelector('[title="last"]').value);
    let ticket_num = cur_last_val - cur_first_val + 1;

    if (cur_first_val > 0 && ticket_num >= 0) {
        cur_row.querySelector('.num-tickets').textContent = ticket_num;
    }
    else {
        cur_row.querySelector('.num-tickets').textContent = '0';
    }

    //let all_tickets_no = document.querySelectorAll('.num-tickets');

    gv_grandTotal = 0;
    document.querySelectorAll('.num-tickets').forEach((element) => {
         gv_grandTotal += Number(element.textContent)
    });

    // Early warnings. Will also be checked before final registration
    if (cur_last_val > gc_max_ticket_num) {
        // Ticket number is too big
        raiseAlert(102);
    }
    else if (gv_grandTotal > gc_tooManyTickets) {
        // Total number of tickets is too big
        raiseAlert(103);
    }

    document.querySelector('#totalNo').textContent = gv_grandTotal || '0';

}

// New draw
function drawTicket() {
    const colorField = 0;                 // Index for color part in array
    const labelField = 1;                 // Index for label part in array
    
    let nTicketsLeft = Object.keys(gv_all_tickets).length;
    
    if (nTicketsLeft > 0) {
        
        document.querySelector('#menu-icon').style.color = 'black';
        document.querySelector('#winner-ticket').style.display = 'none';
        document.querySelector('#spinner-panel').style.display = (disclosureTime > 0) ? 'flex' : 'none';

        let winner = Object.keys(gv_all_tickets)[Math.floor(Math.random() * nTicketsLeft)];
        gv_drawHistory.push(gv_all_tickets[winner]);
        document.querySelector('#logItem').textContent = gv_drawHistory.length;

        document.querySelector('#winner-ticket').className = gv_all_tickets[winner][colorField];
        let ticket_text = document.querySelector('#ticket-text');
        ticket_text.textContent = gv_all_tickets[winner][labelField];

        if (gv_drawHistory.length === 1) {
            // Set font size based on max length of ticket text
            ticket_text.style.fontSize = gv_ticketFontSize;
            document.querySelector('#regret').style.display = 'none';
            document.querySelector('#reset-warning').textContent = 
                'This will end the current session and reset the app.';
        }
        
        delete gv_all_tickets[winner];

        gv_historyIndex = gv_drawHistory.length - 1;

        document.querySelector('#prev').disabled = gv_historyIndex ? false : true;
        document.querySelector('#draw').style.opacity = nTicketsLeft > 1 ? 1 : 0.3;
        document.querySelector('#next').disabled = true;

        document.querySelector('#repetition').style.display = 'none';

        // Reveal winner when the spinner stops
        gv_countdown = setTimeout(revealWinner, disclosureTime*1000, ticket_text);
    }
}

// Start reviewing
function startReview() {

    if (document.querySelector('input').disabled == false) return;

    // stop spinner
    clearTimeout(gv_countdown);
    document.querySelector('#spinner-panel').style.display = 'none';

    // Switch page
    document.querySelector('#winner-ticket').style.display = 'none';
    document.querySelector('html').style.backgroundColor = 'beige';
   
    document.querySelector('#menu-icon').style.color = 'black';
    document.querySelector('#registration').style.display = 'block';
    
    document.querySelectorAll('.buttonSet').forEach((element) => { element.style.display = 'none' });
    document.querySelector('#close').style.display = 'inline-block';

}

// Back to drawing
function endReview() {

    if (document.querySelector('#close').style.display == 'none') return;

    // Switch page
    document.querySelector('#registration').scrollTop = 0;
    document.querySelector('#registration').style.display = 'none';
    document.querySelector('#winner-ticket').style.display = 'flex';
    
    document.querySelector('html').style.backgroundColor = 'whitesmoke';
    document.querySelector('#menu-icon').style.color = getComputedStyle(document.querySelector('#ticket-text')).color;
    document.querySelectorAll('.buttonSet').forEach((element) => { element.style.display = 'inline-block' });
    
    document.querySelector('#close').style.display = 'none';

    if ( gv_drawHistory.length > 0 && gv_drawHistory.length > gv_historyIndex) {
        document.querySelector('#repetition').style.display = 'flex';
        document.querySelector('#regret').style.display = 'none';
    }

    document.querySelector('#draw').disabled = false;
    document.querySelector('#prev').disabled = (gv_historyIndex > 0) ? false : true;
    document.querySelector('#next').disabled = (gv_drawHistory.length > gv_historyIndex+1) ? false : true;

}

// Set the dislosure time i.e. the spinning time of the spinner
function confirmDisclosureTime() {

    disclosureTime = slider.value;
    // Close page
    document.querySelector('#setDisclosureTime').style.display = 'none';

}

// Reset the dislosure time
function resetDisclosureTime() {

    document.querySelector('#disclosure-time').value = disclosureTime;
    document.querySelector('#rangeValue').textContent = parseFloat(disclosureTime).toFixed(1);

    // Close page
    document.querySelector('#setDisclosureTime').style.display = 'none';

}

// Raise warning messages
function raiseAlert(message_no) {

    let message;

    switch(message_no) {
        case 101:
          message = `Total number of tickets is too small. Minimum is 2.`;
          break;
        case 102:
          message = `Ticket number is too big. Maximum is ${gc_max_ticket_num}.`;
          break;
        case 103:
          message = `Total number of tickets is too big. Maximum is ${gc_max_ticket_num}.`;
          break;
        case 104:
          message = "Two or more ticket ranges are overlapping.";
          break;          
        default:
          message = "Unexpected condition.";
    }

    document.querySelector("#alert-text").textContent = message;
    document.querySelector("#alert").style.display = 'block';
}

// Register all the tickets
function registerTickets() {

    if (gv_drawHistory.length > 0) return;

    let inputTable = document.querySelector('table');
    let letter, color, from, to, label, ticketNum;
    let longestLabelLen = 1;        // longest label length
    let selection;
    let grandTotal = 0;
    let i;

    if (gv_grandTotal < 2) {
        // Total number of tickets must be larger than one
        raiseAlert(101);
        return;
    }

    if (gv_grandTotal > gc_tooManyTickets) {
        // Total number of tickets is too big
        raiseAlert(103);
        return;
    }

    // Check if overlaps exists
    for (i = 0; i < gv_overlaps.length; i++) {
        if (gv_overlaps[i].size > 0 && gv_overlaps[i].has(NaN) === false)
            break;
    }

    if (i < gv_overlaps.length) {
        // Ticket ranges are overlapping
        raiseAlert(104);
        return;
    }

    for (i = 0; i < inputTable.rows.length-2; i++) {

        color = inputTable.querySelectorAll('tr [title="color"]')[i].value;
        letter = inputTable.querySelectorAll('tr [title="letter"]')[i].value;
        from = Number(inputTable.querySelectorAll('tr [title="first"]')[i].value);
        to = Number(inputTable.querySelectorAll('tr [title="last"]')[i].value);

        for (ticketNum = from; 0 < ticketNum && ticketNum <= to; ticketNum++) {
            if (letter >= 'A') {
                label = letter + ' ' + ticketNum.toString();
            } else {
                label = ticketNum.toString();
            }
            gv_all_tickets[grandTotal++] = [color, label];
        }

        longestLabelLen = Math.max(label.length, longestLabelLen);

    }

    gv_ticketFontSize = String(24 + (7-longestLabelLen)*4)+'vmin'; // 24,28,32,36,40,44,48vmin

    document.querySelectorAll('#registration input').forEach((element) => { element.disabled = true });
    document.querySelectorAll('[title="color"], [title="letter"]').forEach((element) => { element.disabled = true });
    document.querySelectorAll('.cancel-x').forEach((element) => { element.classList.remove("remove-item") });

    window.scrollTo(0, 0);

    document.querySelector('#page-heading').textContent = 'REGISTERED TICKETS';
    document.querySelector('#read-only').style.display = 'grid';
    document.querySelector('#review-button').style.opacity = '1.0';
    
    selection = document.querySelector('#registration');
    selection.scrollTop = 0;
    selection.style.display = 'none';

    // Switch page
    document.querySelector('#winner-ticket').style.display = 'flex';

    document.querySelector('#draw').disabled = false;
    document.querySelector('#prev').disabled = true;
    document.querySelector('#next').disabled = true;
    
}

// Regret registration
function regretRegistration() {

    document.querySelectorAll('input').forEach((element) => { element.disabled = false });
    document.querySelectorAll('.select-color, .select-letter').forEach((element) => { element.disabled = false });
    document.querySelectorAll('.cancel-x').forEach((element) => { element.classList.add("remove-item") });

    window.scrollTo(0, 0);

    document.querySelector('#page-heading').textContent = 'REGISTER TICKETS';
    document.querySelector('#read-only').style.display = 'none';
    document.querySelector('#review-button').style.opacity = '0.3';
   
    // selection = document.querySelector('#advert').style.display = 'none';
    let selection = document.querySelector('#registration');
    selection.scrollTop = 0;
    selection.style.display = 'block';

    // Switch page
    selection = document.querySelector('#winner-ticket').style.display = 'none';
    
    document.querySelector('#draw').disabled = true;
    
}

// Remove an item
function removeItem(element) {

    let selection = document.querySelectorAll('[aria-label="inputRecord"]');

    if (selection.length > 1) {
        
        const removed_item_idx = element.closest('tr').rowIndex-1;

        // Subtract the deleted number of tickets
        gv_grandTotal -= Number(selection[removed_item_idx].querySelector('.num-tickets').textContent);
        
        // Renumber the form items and adjust the sets of overlaps
        for (let i = 0; i < selection.length; i++) {
            if (i === removed_item_idx) continue;

            // Renumber the succeeding rows
            if (i > removed_item_idx) {
                selection[i].querySelector('.item-no').textContent = i;
            }

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
        selection[0].querySelector('.num-tickets').textContent = '0';
        gv_overlaps = [new Set([NaN])];
        gv_grandTotal = 0;
    }

    document.querySelector('#totalNo').textContent = gv_grandTotal || '0';

    setStatusLights();

}

// Reset all data before registering new tickets
function resetApp() {

    gv_overlaps = [new Set([NaN])];
    gv_drawHistory = [];
    gv_all_tickets = {};
    gv_historyIndex = -1;
    gv_color_index = -1;
    gv_grandTotal = 0;

    // Stop spinner
    clearTimeout(gv_countdown);
    document.querySelector('html').style.backgroundColor = 'whitesmoke';
    document.querySelector('#spinner-panel').style.display = 'none';
     
    // Hide resetApp card
    document.querySelector('#reset').style.display = 'none';
    document.querySelectorAll('#reset button').forEach((element) => { element.style.width = '4em' });

    // Switch page
    document.querySelector('#registration').style.display = 'block';
    document.querySelector('#winner-ticket').style.display = 'none';

    document.querySelector('#page-heading').textContent = 'TICKET REGISTRATION';
    document.querySelector('#read-only').style.display = 'none';
    document.querySelector('#reset-warning').textContent = 'This will reset the app.';

    // Remove all but one items
    document.querySelectorAll('[aria-label="inputRecord"]').forEach((element, idx) => { if (idx > 0) element.remove(); });
    
    let colorClass = nextColor();
    document.querySelector('[aria-label="inputRecord"]').className = colorClass;
    document.querySelector(`[title="color"] .${colorClass}`).selected = 'selected';
    document.querySelector('[title="letter"]').value = '';
    document.querySelector('[title="first"]').value = 1;
    document.querySelector('[title="last"]').value = '';    
    document.querySelector('.num-tickets').textContent = '0';

    // Make inputs editable
    document.querySelectorAll('input').forEach((element) => { element.disabled = false });
        
    document.querySelector('#menu-icon').style.color = 'black';
    document.querySelector('#insert').disabled = false;
    document.querySelector('#repetition').style.display = 'none';
    document.querySelector('#winner-ticket').removeAttribute('class');
    document.querySelector('#ticket-text').innerHTML = gc_splashScreenImg;
    document.querySelector('#logItem').textContent = ' ';
    document.querySelector('#totalNo').textContent = '0';
    document.querySelector('#prev').disabled = true;
    document.querySelector('#next').disabled = true;
    document.querySelector('#review-button').style.opacity = '0.3';
    document.querySelector('#draw').style.opacity = 1;
    document.querySelector('#regret').style.display = 'none';

    document.querySelector('.status-light').style.backgroundColor = 'Orange';
    document.querySelector('.num-tickets').textContent = '0';

    document.querySelectorAll('.select-color, .select-letter').forEach((element) => { element.disabled = false });
    document.querySelectorAll('.cancel-x').forEach((element) => { element.classList.add('remove-item') });
    document.querySelectorAll('.buttonSet').forEach((element) => { element.style.display = 'inline-block' });

    document.querySelector('#close').style.display = 'none';

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
    
    document.querySelector('#winner-ticket').className = gv_drawHistory[gv_historyIndex][0];
    // Show a big R to remind the user that this is a repetition
    document.querySelector('#repetition').style.display = 'flex';
    document.querySelector('#ticket-text').textContent = gv_drawHistory[gv_historyIndex][1].toString();

    document.querySelector('#logItem').textContent = gv_historyIndex + 1;
    document.querySelector('#menu-icon').style.color = getComputedStyle(document.querySelector('#ticket-text')).color;
    
}

// Events

slider.oninput = function() {
    slider.textContent = this.value;
    document.querySelector('#rangeValue').textContent = parseFloat(slider.value).toFixed(1);
}

document.querySelector('tbody').addEventListener('input', evalRegistationEvent);
document.querySelector('tbody').addEventListener('change', evalRegistationEvent);
document.querySelector('tbody').addEventListener('click', evalRegistationEvent);
document.querySelector('#registrationButtons').addEventListener('click', evalRegistationButtonEvent);
document.querySelector('#ticketButtons').addEventListener('click', evalDrawingEvents);
document.addEventListener('click', evalModalEvent);
document.addEventListener('keyup', evalShortcut, true);

// Evaluate events

function evalRegistationEvent(event) {

    if (event.target.className == 'select-color') {
        event.target.closest('tr').className = event.target.value;
        checkOverlaps(event);
    }
    else if (event.target.className == 'select-letter') {
        checkOverlaps(event);
    }
    else if (event.target.className == 'ticket-number') {
        countTickets(event);
        checkOverlaps(event);
    }
    else if (event.target.classList.contains('remove-item')) { 
        removeItem(event.target);
    }

    event.stopPropagation();
}

function evalRegistationButtonEvent(event) {

    switch (event.target.id) {
        case 'insert':
            addRecord();
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

    if (event.target.id == 'setDisclosureTime') {
        resetDisclosureTime();
    }
    else if (event.target.classList.contains('w3-modal')) {
        event.target.style.display = 'none';
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


// Key events
function evalShortcut(event) {

    // Resetting mode
    if (document.querySelector('#reset').style.display == 'block') {
        switch (event.keyCode) {
            case 78: { // character N
                document.querySelector('#reset').style.display = 'none';
                break;
            } 
            case 89: { // charater Y
                resetApp();
                break;
            }
        }
        return;
    }

    // Registration mode
    if (document.querySelector('#read-only').style.display == 'none') {
        switch (event.keyCode) {
            case 34: { // <PageDown>        => ready
                registerTickets();
                break;
            }    
            case 45: { // <Insert>          => insert
                addRecord();
                break;
            }
        }
        return;
    }

    // Drawing mode
    if (document.querySelector('#winner-ticket').style.display == 'flex') {
        switch (event.keyCode) {
            case 13: // <Enter> or <Space>  => draw
            case 32: {
                drawTicket();
                break;
            }
            case 33: { // <PageUp>          => regret
                if (gv_drawHistory.length === 0)
                    regretRegistration();
                else
                    startReview();
                break;
            }        
            case 34: { // <PageDown>        => ready
                registerTickets();
                break;
            }          
            case 37: { // <LeftArrow>       => prev
                traverseHistory(-1);
                break;
            } 
            
            case 39: { // <RightArrow>      => next
                traverseHistory(1);
                break;
            }
        }
        return;
    }

    // Review mode
    if (document.querySelector('#read-only').style.display == 'grid') {
        if (event.keyCode == 34) { // <PageDown>
            endReview();  // close
        }
        return;
    }
}    

function getRandomLetter() {
return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

function getRandomNumber() {
return Math.floor(Math.random() * 999) + 1;
}

function updateCardIfZIndexZero(card) {
const z = window.getComputedStyle(card).zIndex;

if (z === '0') {
    seenAtZ0.add(card);
} else {
    // Reset tracker when it's not at z-index 0 anymore
    seenAtZ0.delete(card);
}
}

setInterval(() => {
cards.forEach(card => updateCardIfZIndexZero(card));
}, 200); // Check 5 times per second
