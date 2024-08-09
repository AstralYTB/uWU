const db = require('quick.db');

function getTicketOptions(guildId) {
    return db.get(`ticketOptions_${guildId}`) || [];
}

function addTicketOption(guildId, option) {
    const ticketOptions = getTicketOptions(guildId);
    ticketOptions.push(option);
    db.set(`ticketOptions_${guildId}`, ticketOptions);
}

function deleteTicketOption(guildId, optionName) {
    let ticketOptions = getTicketOptions(guildId);
    ticketOptions = ticketOptions.filter(option => option.label !== optionName);
    db.set(`ticketOptions_${guildId}`, ticketOptions);
}

module.exports = {
    getTicketOptions,
    addTicketOption,
    deleteTicketOption,
};
