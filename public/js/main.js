'use strict';

const max_ticket_num = 99999;    // No ticket number can be larger than this number.
const tooManyTickets = 99999;    // A warning will be raised if the sum of tickets is greater than this number.

var disclosureTime = "3.0";
var ticketFontSize = '25vmin';   // Standard font size for tickets
var drawHistory = [];
var tickets = {};
var historyIndex = -1;           // Index number for drawn tickets
var overlaps = [new Set().add(NaN)];  // NaN indicates an incomplete record
var timer;                       // Variable for controlling timout of spinner.
var color_classes = [
    'tombola-pale-blue', 'tombola-pale-green', 'tombola-pale-red', 'tombola-pale-yellow',
    'tombola-bright-blue', 'tombola-bright-green', 'tombola-bright-red', 'tombola-bright-yellow',
    'tombola-brown', 'tombola-orange', 'tombola-purple', 'tombola-teal',
    'tombola-black', 'tombola-gray', 'tombola-silver', 'tombola-white', 'tombola-whitesmoke'
];

// Tombola Draw code

var slider = document.getElementById("select-seconds");
var output = document.getElementById("mixTime");
var color_index = 0;

output.innerHTML = parseFloat(slider.value).toFixed(1);

slider.oninput = function() {
    output.innerHTML = parseFloat(this.value).toFixed(1);
}

setColorClass(document.getElementsByClassName('formItem')[0], 'unspecified');

// Set background color
function setColorClass (elem, color_cls) {
    var ticket_color;

    for (ticket_color of color_classes) {
        elem.classList.remove(ticket_color);
    }

    elem.style.backgroundColor = '';
    elem.style.color = '';

    if (color_cls == 'unspecified') {
        ticket_color = color_classes[color_index];
        color_index = (color_index >= 15) ? 0 : color_index + 1;
        elem.querySelector('.select-color .'+ticket_color).selected = 'selected';
    }
    else {
        ticket_color = color_cls;
    }

    elem.classList.add(ticket_color);

}

// Add an item
function addItem () {

    // Add new item.
    var form_tab = document.querySelector('tbody');
    var first_child = form_tab.querySelectorAll('tr')[0];
    var new_child = first_child.cloneNode(true);

    setColorClass(new_child, 'unspecified');
    new_child.querySelector('.item-no').innerHTML = form_tab.querySelectorAll('tr').length+1;
    new_child.querySelector('.first-number').value = '1';
    new_child.querySelector('.last-number').value = null;
    new_child.querySelector('.status-light').style.backgroundColor = 'Orange';
    new_child.querySelector('.num-tickets').innerHTML = '0';
    form_tab.appendChild(new_child);

    // Scroll to bottom of list
    new_child.scrollIntoView();
    
    overlaps.push(new Set().add(NaN));

}

// Check overlapping series of tickets
function checkOverlaps(element) {

    var all_rows = document.querySelectorAll('.formItem');
    var cur_color;
    var cur_letter;
    var cur_row = element.srcElement.closest('tr');
    var cur_index = cur_row.rowIndex-1;
    var cur_first_val = Number(cur_row.querySelector('.first-number').value);
    var cur_last_val = Number(cur_row.querySelector('.last-number').value);
    var other_first_val;
    var other_last_val;

    if (!Number.isInteger(cur_first_val) || !Number.isInteger(cur_last_val)
       || cur_first_val <= 0 || cur_first_val > cur_last_val) {

        for (let item of overlaps[cur_index]) {
            if (item >= 0) overlaps[item].delete(cur_index);
        }

        overlaps[cur_index].clear;
        overlaps[cur_index].add(NaN);
    }
    else {

        for (cur_index = 0; cur_index < all_rows.length; cur_index++) {

            cur_color = all_rows[cur_index].querySelector('.select-color').value;
            cur_letter = all_rows[cur_index].querySelector('.select-letter').value;
            cur_first_val = Number(all_rows[cur_index].querySelector('.first-number').value);
            cur_last_val = Number(all_rows[cur_index].querySelector('.last-number').value);

            if (cur_first_val > 0 && cur_last_val >= cur_first_val) {

                overlaps[cur_index].delete(NaN);  // Data record is complete.

                for (var other = cur_index+1; other < all_rows.length && other < overlaps.length; other++) {

                    other_first_val = Number(all_rows[other].querySelector('.first-number').value);
                    other_last_val = Number(all_rows[other].querySelector('.last-number').value);

                    if (all_rows[other].querySelector('.select-color').value !== cur_color ||
                        all_rows[other].querySelector('.select-letter').value !== cur_letter ||
                        other_first_val > cur_last_val ||
                        other_last_val < cur_first_val
                    ) {
                        overlaps[other].delete(cur_index);
                        overlaps[cur_index].delete(other);
                    }
                    else if (!isNaN(other_first_val) && !isNaN(other_last_val)) {
                        overlaps[other].add(cur_index);
                        overlaps[cur_index].add(other);
                    }
                };
            }
        }
    }

    setStatusLights();
}

// Calculate number and accumulated number of tickets
function countTickets(element) {

    var cur_row = element.srcElement.closest('.formItem');
    var cur_first_val = Number(cur_row.querySelector('.first-number').value);
    var cur_last_val = Number(cur_row.querySelector('.last-number').value);
    var ticket_num = cur_last_val - cur_first_val + 1;
    var total_ticket_num = 0;

    if (cur_first_val > 0 && ticket_num >= 0) {
        cur_row.querySelector('.num-tickets').innerHTML = ticket_num;
    }
    else {
        cur_row.querySelector('.num-tickets').innerHTML = '0';
    }

    var all_tickets_no = document.querySelectorAll('.num-tickets');

    for (var i=0; i < all_tickets_no.length; i++) {
        total_ticket_num += Number(all_tickets_no[i].innerHTML);
    }

    // Early warnings. Will also be checked before final registration.
    if (cur_last_val > max_ticket_num) {
        // Ticket number is too big.
        raiseAlert(102);
    }
    else if (total_ticket_num > tooManyTickets) {
        // Total number of tickets is too big.
        raiseAlert(103);
    }

    document.querySelector('#totalNo').innerHTML = total_ticket_num || '0';

}

// New draw
function drawTicket() {
    var nTicketsLeft = Object.keys(tickets).length;
    var winner;
    var canvas = document.getElementById('winner-ticket');
    var ticket_text = document.getElementById('ticket-text');
    var menu_icon = document.getElementById('menu-icon');
    var spinner = document.getElementById('spinner-panel');
    
    if (nTicketsLeft > 0) {
        
        menu_icon.style.color = 'black';
        canvas.style.display = 'none';
        spinner.style.display = (disclosureTime > 0) ? 'flex' : 'none';

        timer = setTimeout(function () {

            winner = Object.keys(tickets)[Math.floor(Math.random() * nTicketsLeft)];
            drawHistory.push(tickets[winner]);
            document.getElementById('logItem').innerHTML = drawHistory.length;

            document.getElementById('ticket-text').classList.remove('w3-animate-left', 'w3-animate-right','w3-animate-zoom')
            document.getElementById('ticket-text').classList.add('w3-animate-zoom');

            setColorClass (canvas, tickets[winner][0]);
            menu_icon.style.color = getComputedStyle(canvas).color;
            ticket_text.innerHTML = tickets[winner][1];

            if (drawHistory.length === 1) {
                // Set font size based on max length of ticket text.
                ticket_text.style.fontSize = ticketFontSize;
                document.getElementById('regret').style.display = 'none';
            }
           
            delete tickets[winner];

            historyIndex = drawHistory.length - 1;

            document.getElementById('prev').disabled = historyIndex ? false : true;
            document.getElementById('draw').style.opacity = nTicketsLeft > 1 ? 1 : 0.3;
            document.getElementById('next').disabled = true;

            canvas.style.display = 'flex';
            spinner.style.display='none';

        }, disclosureTime*1000);

        document.getElementById('repetition').style.visibility = 'hidden';

    }

}

// Start reviewing
function startReview() {

    if (document.getElementsByTagName('input')[0].readOnly == false) return;

    // stop spinner
    clearTimeout(timer);
    document.getElementById('spinner-panel').style.display='none';

    // Switch page
    // document.getElementById('menu-dropdown-content').style.display = 'none';
    document.getElementById('winner-ticket').style.display = 'none';
    document.querySelector('#menu-dropdown-hover').classList.add('advert-mode');
   
    /* document.getElementById('spinner-panel').style.display = 'none'; */
    document.getElementById('menu-icon').style.color = 'black';
    document.getElementById('registration').style.display = 'block';
    
    var selection = document.querySelectorAll('.buttonSet');
    for (var i = 0; i < selection.length; i++) {
        selection[i].style.display = 'none';
    }
    
    document.querySelector('#close').style.display = 'inline-block';

}

// Back to drawing.
function endReview() {

    // Switch page
    document.getElementById('registration').scrollTop = 0;
    document.getElementById('registration').style.display = 'none';
    document.getElementById('winner-ticket').style.display = 'flex';
    document.querySelector('#menu-dropdown-hover').classList.remove('advert-mode');

    document.getElementById('menu-icon').style.color = getComputedStyle(document.getElementById('ticket-text')).color;

    document.querySelector('#ticket-text').classList.remove('w3-animate-left', 'w3-animate-right','w3-animate-zoom');

    var selection = document.querySelectorAll('.buttonSet');
    for (var i = 0; i < selection.length; i++) {
        selection[i].style.display = 'inline-block';
    }
    
    document.querySelector('#close').style.display = 'none';

    if ( drawHistory.length > 0 && drawHistory.length > historyIndex) {
        document.getElementById('repetition').style.visibility = 'visible';
        document.getElementById('regret').style.display = 'none';
        /* document.getElementsByClassName('advert').style.display = 'none'; */
    }

    document.getElementById('draw').disabled = false;
    document.getElementById('prev').disabled = (historyIndex > 0) ? false : true;
    document.getElementById('next').disabled = (drawHistory.length > historyIndex+1) ? false : true;

}

// Set the dislosure time i.e. the time the spinner is spinning.
function confirmMixingTime() {

    disclosureTime = document.querySelector('#select-seconds').value;
    // Close page
    document.getElementById('mixingTime').style.display = 'none';

}

// Reset the dislosure time.
function resetMixingTime() {

    document.querySelector('#select-seconds').value = disclosureTime;
    document.querySelector('#mixTime').innerHTML = disclosureTime;
    // Close page
    document.getElementById('mixingTime').style.display = 'none';

}

// Raise warning messages.
function raiseAlert(message_no) {

    var message;

    switch(message_no) {
        case 101:
          message = `Total number of tickets is too small. Minimum is 2.`;
          break;
        case 102:
          message = `Ticket number is too big. Maximum is ${max_ticket_num}.`;
          break;
        case 103:
          message = `Total number of tickets is too big. Maximum is ${max_ticket_num}.`;
          break;
        case 104:
          message = "Two or more ticket ranges are overlapping.";
          break;          
        default:
          message = "Unexpected condition.";
    }

    document.querySelector("#alert-text").innerHTML = message;
    document.querySelector("#alert").style.display = 'block';
}

// Register all the tickets
function registerTickets() {

    var inputTable = document.querySelector('table');
    var letter, color, from, to, label;
    var maxlen = 1;     // max label length
    var total_ticket_num = 0;   // number of tickets
    var selection;

    for (var i = 0; i < inputTable.rows.length-2; i++) {

        color = inputTable.querySelectorAll('.formItem .select-color')[i].value;
        label = ' ';
        letter = inputTable.querySelectorAll('.formItem .select-letter')[i].value;
        from = Number(inputTable.querySelectorAll('.formItem .first-number')[i].value);
        to = Number(inputTable.querySelectorAll('.formItem .last-number')[i].value);

        for (var j = from; j > 0 && j <= to; j++) {
            if (letter >= 'A') {
                label = letter + '&nbsp;' + j.toString();
            } else {
                label = j.toString();
            }
            tickets[total_ticket_num++] = [color, label];
        }

        maxlen = Math.max(label.replace('&nbsp;',' ').length, maxlen);

    }

    ticketFontSize = String(24 + (7-maxlen)*4)+'vmin'; // 28,32,36,40,44,48,52vmin

    document.querySelector('#menu-dropdown-hover').classList.remove('advert-mode');

    selection = document.getElementsByTagName('input');
    for (var i = 0; i < selection.length; i++) selection[i].readOnly = true;

    selection = document.querySelectorAll('.select-color, .select-letter');
    for (var i = 0; i < selection.length; i++) selection[i].disabled = true;

    selection = document.querySelectorAll('.cancel-x');
    for (var i = 0; i < selection.length; i++) {
        selection[i].classList.remove("remove-item");
    }

    window.scrollTo(0, 0);
    total_ticket_num = 0;

    document.getElementById('page-heading').innerHTML = 'REGISTERED TICKETS';
    document.getElementById('read-only').style.display = 'grid';
    document.getElementById('review-button').style.opacity = '1.0';
    
    // selection = document.getElementById('advert').style.display = 'none';
    selection = document.getElementById('registration');
    selection.scrollTop = 0;
    selection.style.display = 'none';

    // Switch page
    selection = document.getElementById('winner-ticket');
    selection.style.display = 'flex';

    document.getElementById('draw').disabled = false;
    document.getElementById('prev').disabled = true;
    document.getElementById('next').disabled = true;
    
    window.addEventListener('keyup', keyPressed, true);

}

// Regret registration
function regretRegistration() {

    var inputTable = document.querySelector('table');
    var letter, color, from, to, label;
    var selection;

    document.querySelector('#menu-dropdown-hover').classList.add('advert-mode');

    selection = document.getElementsByTagName('input');
    for (var i = 0; i < selection.length; i++) selection[i].readOnly = false;

    selection = document.querySelectorAll('.select-color, .select-letter');
    for (var i = 0; i < selection.length; i++) selection[i].disabled = false;

    selection = document.querySelectorAll('.cancel-x');
    for (var i = 0; i < selection.length; i++) {
        selection[i].classList.add("remove-item");
    }

    window.scrollTo(0, 0);

    document.getElementById('page-heading').innerHTML = 'REGISTER TICKETS';
    document.getElementById('read-only').style.display = 'none';
    document.getElementById('review-button').style.opacity = '0.3';
    
    // selection = document.getElementById('advert').style.display = 'none';
    selection = document.getElementById('registration');
    selection.scrollTop = 0;
    selection.style.display = 'block';

    // Switch page
    selection = document.getElementById('winner-ticket').style.display = 'none';
    
    document.getElementById('draw').disabled = true;
    
}

// Remove an item
function removeItem(element) {

    var total_ticket_num = Number(document.querySelector('#totalNo').innerHTML);
    var selection = document.querySelectorAll('.formItem');

    if (selection.length > 1) {
        
        const removed_item_idx = element.closest('tr').rowIndex-1;

        // Subtract the deleted number of tickets
        total_ticket_num -= Number(selection[removed_item_idx].querySelector('.num-tickets').innerHTML);
        
        // Renumber the form items and adjust the sets of overlaps
        for (var i = 0; i < selection.length; i++) {
            if (i === removed_item_idx) continue;

            // Renumber the succeeding rows
            if (i > removed_item_idx) {
                selection[i].querySelector('.item-no').innerHTML = i;
            }

            // Delete the removed item from the current set of overlaps
            overlaps[i].delete(removed_item_idx);

            // Recalculate the overlaps
            for (let j of new Set(overlaps[i])) {
                if (j <= removed_item_idx) continue;
                overlaps[i].delete(j);
                overlaps[i].add(j - 1);
            }
        }

        // Remove element and overlap array
        element.closest('tr').remove();
        overlaps.splice(removed_item_idx, 1);

    }
    else {
        setColorClass(selection[0], 'unspecified');
        selection[0].querySelector('.select-letter').value = '';
        selection[0].querySelector('.first-number').value = 1;
        selection[0].querySelector('.last-number').value = '';    
        selection[0].querySelector('.num-tickets').innerHTML = '0';
        overlaps = [new Set().add(NaN)];
        total_ticket_num = 0;
    }

    document.querySelector('#totalNo').innerHTML = total_ticket_num || '0';

    setStatusLights();

}

// Reset all data before registering new tickets
function resetApp() {

    var selection;

    color_index = 0;

    // Stop spinner
    clearTimeout(timer);
    document.getElementById('spinner-panel').style.display='none';
     
    // Hide confirm card
    document.getElementById('confirm').style.display='none';

    // Switch page
    document.getElementById('registration').style.display = 'block';
    document.getElementById('winner-ticket').style.display = 'none';

    document.querySelector('#menu-dropdown-hover').classList.add('advert-mode');

    document.getElementById('page-heading').innerHTML = 'TICKET REGISTRATION';
    document.getElementById('read-only').style.display = 'none';

    // Remove all but one input items
    var selection = document.getElementsByClassName('formItem');
    while (selection.length > 1) {
        selection[1].remove();
    }

    document.getElementById('menu-icon').style.color = 'black';
        
    setColorClass(selection[0], 'unspecified');
    selection[0].querySelector('.select-letter').value = '';
    selection[0].querySelector('.first-number').value = 1;
    selection[0].querySelector('.last-number').value = '';    
    selection[0].querySelector('.num-tickets').innerHTML = '0';
    overlaps = [new Set().add(NaN)];

    document.getElementById('prev').disabled = true;
    document.getElementById('next').disabled = true;
    document.getElementById('add').disabled = false;
    document.getElementById('review-button').style.opacity = '0.3';

    document.getElementById('repetition').style.visibility = 'hidden';
    document.getElementsByClassName('status-light')[0].style.backgroundColor = 'Orange';

    selection = document.getElementById('winner-ticket');
    selection.style.backgroundColor = 'transparent';
    selection.style.color = 'black';

    selection = document.getElementById('ticket-text');
    selection.innerHTML = '<img src="images/tombola-splash-001.webp" alt="Splash screen" style="width:50vmin" class="w3-card-4">';
    selection.style.fontSize = '25vmin';
    selection.classList.remove('w3-animate-left', 'w3-animate-right','w3-animate-zoom');

    document.getElementById('logItem').innerHTML = '&nbsp';
    document.getElementsByClassName('num-tickets')[0].innerHTML = '0';
    document.getElementById('totalNo').innerHTML = '0';

    selection = document.getElementsByTagName('input');
    for (var i = 0; i < selection.length; i++) selection[i].readOnly = false;

    selection = document.querySelectorAll('.select-color, .select-letter');
    for (var i = 0; i < selection.length; i++) selection[i].disabled = false;

    selection = document.querySelectorAll('.cancel-x');
    for (var i = 0; i < selection.length; i++) {
        selection[i].classList.add('remove-item');
    }
    
    selection = document.querySelectorAll('.buttonSet');
    for (var i = 0; i < selection.length; i++) {
        selection[i].style.display = 'inline-block';
    }

    document.getElementById('draw').style.opacity = 1;
    document.querySelector('#close').style.display = 'none';
    document.getElementById('regret').style.display = '';

    drawHistory = [];
    tickets = {};
    historyIndex = -1;

}

// Set correct status light
function setStatusLights() {

    for (var i = 0; i < overlaps.length; i++) {

        if (overlaps[i].size) {
            if (overlaps[i].has(NaN))
                document.querySelectorAll('.formItem .status-light')[i].style.backgroundColor = 'orange';
            else
                document.querySelectorAll('.formItem .status-light')[i].style.backgroundColor = 'red';
        } else
            document.querySelectorAll('.formItem .status-light')[i].style.backgroundColor = 'green';

    }

}

// Show a previous draw if requested
function traverseHistory(incr) {

    historyIndex += incr;

    // Activate or deactivate the 'Previous' button
    document.getElementById('prev').disabled = (historyIndex === 0) ? true : false;

    // Activate or deactivate the 'Next' button.
    document.getElementById('next').disabled = (historyIndex === drawHistory.length - 1) ? true : false;
    
    setColorClass(document.getElementById('winner-ticket'), drawHistory[historyIndex][0]);
    // Show a big R to remind the user that this is a repetition
    document.getElementById('repetition').style.visibility = 'visible';
    document.getElementById('ticket-text').innerHTML =  drawHistory[historyIndex][1].toString();
    document.getElementById('ticket-text').classList.remove('w3-animate-left', 'w3-animate-right','w3-animate-zoom');
    if (incr < 0) {
      document.getElementById('ticket-text').classList.add('w3-animate-left');
    } else {
      document.getElementById('ticket-text').classList.add('w3-animate-right');
    }

    // Necessary hack to make CSS animation repeatable.
    var elem = document.getElementById('ticket-text');
    var new_elem = elem.cloneNode(true);
    elem.parentNode.replaceChild(new_elem, elem);

    document.getElementById('logItem').innerHTML = historyIndex + 1;
    document.getElementById('menu-icon').style.color = getComputedStyle(document.getElementById('ticket-text')).color;
    
}

// Events
document.addEventListener('input', function(e) {
    if (e.target) {
        if (e.target.className == 'first-number' || e.target.className == 'last-number') {
            countTickets(e);
            checkOverlaps(e);        
        }
    }
});

// Click events
document.addEventListener('click', function(e) {
    if (e.target) {

        if (e.target.id == 'add' /* || e.target.alt == 'add' */)
            addItem();
        else if (e.target.classList.contains('remove-item'))
            removeItem(e.target);
        else if (e.target.id == 'ready') {

            var total_ticket_num = Number(this.getElementById('totalNo').innerHTML);

            if (total_ticket_num < 2) {
                // Total number of tickets must be larger than one.
                raiseAlert(101);
            }
            else if (total_ticket_num > tooManyTickets) {
                // Total number of tickets is too big.
                raiseAlert(103);
            }
            else {

                // Check if overlaps exists
                for (var i = 0; i < overlaps.length; i++) {
                    if (overlaps[i].size > 0 && overlaps[i].has(NaN) === false)
                        break;
                }

                if (i < overlaps.length) {
                    // Ticket ranges are overlapping.
                    raiseAlert(104);
                }
                else
                    registerTickets();

            }

        }
        else if (e.target.id == 'regret')
            regretRegistration();
        else if (e.target.id == 'close')
            endReview();
        else if (e.target.id == 'draw')
            drawTicket();
        else if (e.target.id == 'next')
            traverseHistory(1);
        else if (e.target.id == 'prev')
            traverseHistory(-1);

    }
});

// Key events
function keyPressed(event) {
    var key = event.keyCode;
    if (document.querySelector('#winner-ticket').style.display === 'flex'
       ) {
        if (key == 13 || key == 32) {
            drawTicket();
        }
        else if (key == 37 || key == 80) {
            if (historyIndex > 0) traverseHistory(-1);
        }
        else if (key == 39 || key == 78) {
            if (historyIndex < drawHistory.length - 1) traverseHistory(1);
        }
    }
}

// Change events //
document.getElementById('registration').addEventListener('change', function(e) {
    if(e.target) {
        if (e.target.className == 'select-color') {

            var selected_color = e.target.value;
            var selected_row = e.target.closest('tr');
            var ticket_color;

            for (ticket_color of color_classes) {
                selected_row.classList.remove(ticket_color)
            }
        
            selected_row.classList.add(selected_color);
            checkOverlaps(e);
        }
        else if (e.target.className == 'select-letter') {
            checkOverlaps(e);
        }  
    }
});
