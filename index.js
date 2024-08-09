const { ActivityType } = require('discord-api-types/v9');
const { Client, Intents, MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const fs = require('fs');
const path = require("path")
const db = require('quick.db');
const ms = require('ms');
const ticketOptions = require('./tickets');
const config = require("./config.json")


const client = new Client({ 
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MEMBERS] 
});


const DEFAULT_PREFIX = '+';

client.once('ready', () => {
    console.log('[+] CROWBOTS LEAK - ON');

    client.user.setActivity(`CrowBots leak by Hichioo`, { type: "STREAMING", url: 'https://www.twitch.tv/hichioo' })

    
});


client.on('messageCreate', async (message) => {
    const suggestionChannelId = db.get(`suggestion_channel_${message.guild.id}`);
    if (message.author.bot) return;

    if (message.channel.id === suggestionChannelId) {
        message.delete();

        const themeColor = db.get(`theme_${message.guild.id}`) || "#ffffff";

        const embed = new MessageEmbed()
            .setColor(themeColor)
            .setTitle(`Suggestion de ${message.author.tag}`)
            .setDescription(message.content);

        const yesButton = new MessageButton()
            .setCustomId('yes_button')
            .setLabel('✅ (0)')
            .setStyle('SECONDARY');

        const noButton = new MessageButton()
            .setCustomId('no_button')
            .setLabel('❌ (0)')
            .setStyle('SECONDARY');

        const actionRow = new MessageActionRow()
            .addComponents(yesButton, noButton);

        const sentMessage = await message.channel.send({ embeds: [embed], components: [actionRow] });

        const buttonClicks = {
            yes_button: 0,
            no_button: 0
        };

        let lastClickedButton = null;

        const collector = sentMessage.createMessageComponentCollector();

        collector.on('collect', async (interaction) => {
            if (interaction.user.bot) return; 

            await interaction.deferUpdate();

            const buttonId = interaction.customId;

            if (lastClickedButton === buttonId) {
                buttonClicks[buttonId]--;
                lastClickedButton = null;
            } else {
                if (lastClickedButton) {
                    buttonClicks[lastClickedButton]--;
                }
                buttonClicks[buttonId]++;
                lastClickedButton = buttonId;
            }

            yesButton.setLabel(`✅ (${buttonClicks['yes_button']})`);
            noButton.setLabel(`❌ (${buttonClicks['no_button']})`);

            await sentMessage.edit({ components: [actionRow] });
        });

        collector.on('end', () => {
            sentMessage.edit({ components: [] });
        });
    }
});




client.on('messageDelete', async (deletedMessage) => {
    if (deletedMessage.author.bot) return;

    const logConfig = db.get(`messagelog_${deletedMessage.guild.id}`);
    if (!logConfig || !logConfig.enabled) return;

    const logChannel = deletedMessage.guild.channels.cache.get(logConfig.channelId);
    if (!logChannel) return;

    const themeColor = db.get(`theme_${deletedMessage.guild.id}`) || "#ffffff";

    const embed = new MessageEmbed()
        .setColor(themeColor)
        .setTitle('Log - Message Supprimé')
        .addField('Auteur', `<@${deletedMessage.author.id}>`)
        .addField('Contenu', deletedMessage.content || 'Aucun')
        .setFooter(config.name)
        .setTimestamp()

    logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (newMessage.author.bot) return;

    const logConfig = db.get(`messagelog_${newMessage.guild.id}`);
    if (!logConfig || !logConfig.enabled) return;

    const logChannel = newMessage.guild.channels.cache.get(logConfig.channelId);
    if (!logChannel) return;

    const themeColor = db.get(`theme_${newMessage.guild.id}`) || "#ffffff";

    const embed = new MessageEmbed()
        .setColor(themeColor)
        .setTitle('Log - Message Modifié')
        .addField('Auteur', `<@${newMessage.author.id}>`)
        .addField('Contenu Avant', oldMessage.content || 'Aucun')
        .addField('Contenu Après', newMessage.content || 'Aucun')
        .setFooter(config.name)
        .setTimestamp()

    logChannel.send({ embeds: [embed] });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'claim') {
        try {

            const themeColor = db.get(`theme_${interaction.guild.id}`) || "#ffffff";
            await interaction.deferUpdate();

            const currentComponents = interaction.message.components;

            const rowWithButton = currentComponents.find(row => row.components.find(component => component.customId === 'claim'));

            if (rowWithButton) {
                const buttonIndex = rowWithButton.components.findIndex(component => component.customId === 'claim');
                if (buttonIndex !== -1) {
                    rowWithButton.components[buttonIndex].setDisabled(true);
                }

                await interaction.message.edit({
                    components: currentComponents
                });

                const mention = interaction.user.toString();
                const embed = new MessageEmbed()
                    .setColor(themeColor)
                    .setTitle('Ticket Réclamé')
                    .setDescription(`Votre ticket va être pris en charge par: ${mention}`);

                await interaction.channel.send({
                    embeds: [embed]
                });
            }
        } catch (error) {
            console.error('Error processing interaction:', error);
        }
    }
});



client.on('messageCreate', async (message) => {

    const themeColor = db.get(`theme_${message.guild.id}`) || "#ffffff"

    if (message.author.bot) return;

    const modlogConfig = db.get(`modlog_${message.guild.id}`);
    if (!modlogConfig || !modlogConfig.enabled) return;

    const moderationCommands = [
        'addrole', 'ban', 'banlist', 'clear', 'del', 'delrole', 'derank', 'hide',
        'hideall', 'kick', 'lockall', 'mute', 'mutelist', 'sanctions', 'unban',
        'unhide', 'unhideall', 'unlockall', 'unmute', 'unmuteall', 'warn'
    ];

    const commandUsed = moderationCommands.find(cmd => message.content.toLowerCase().startsWith(`+${cmd}`));
    if (!commandUsed) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    const embed = new MessageEmbed()
        .setColor(themeColor)
        .setTitle('Logs - Modération')
        .addField('Utilisateur', message.author.toString())
        .addField('Commande', command)
        .addField('Argument', args.length > 0 ? args.join(' ') : 'Aucun')
        .setTimestamp()
        .setFooter(config.name)

    const modlogChannel = message.guild.channels.cache.get(modlogConfig.channelId);
    if (modlogChannel) {
        modlogChannel.send({ embeds: [embed] });
    }
});



client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, guildId, user } = interaction;
    const giveaways = db.get(guildId) || {};
    const giveawayIds = Object.keys(giveaways);
    const lastGiveawayId = giveawayIds[giveawayIds.length - 1];

    function getCurrentOptions(guildId, giveawayId) {
        const prize = db.get(`${guildId}.${giveawayId}.prize`) || 'Aucun gain défini';
        const time = db.get(`${guildId}.${giveawayId}.time`) || 'Aucun temps défini';
        const winnersCount = db.get(`${guildId}.${giveawayId}.winners`) || 1; 
        const participants = db.get(`${guildId}.${giveawayId}.participants`) || [];
        const channelId = db.get(`${guildId}.${giveawayId}.channelId`) || null;
        const emoji = db.get(`${guildId}.${giveawayId}.emoji`) || ':tada:';

        return {
            prize,
            time,
            winnersCount,
            participants,
            channelId,
            emoji
        };
    }

    function addParticipant(guildId, giveawayId, userId) {
        const participants = db.get(`${guildId}.${giveawayId}.participants`) || [];
        participants.push(userId);
        db.set(`${guildId}.${giveawayId}.participants`, participants);
    }


    function removeParticipant(guildId, giveawayId, userId) {
        let participants = db.get(`${guildId}.${giveawayId}.participants`) || [];
        participants = participants.filter(id => id !== userId);
        db.set(`${guildId}.${giveawayId}.participants`, participants);
    }

    if (customId === 'startGiveaway') {
        const currentOptions = getCurrentOptions(guildId, lastGiveawayId);

        if (!currentOptions.channelId) {
            await interaction.reply({ content: 'Le salon pour le giveaway n\'est pas défini.', ephemeral: true });
            return;
        }

        if (!currentOptions.emoji) {
            await interaction.reply({ content: 'Merci de définir un emoji', ephemeral: true });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

    
    await interaction.followUp({ content: 'Giveaway lancé!', ephemeral: true });

    const emoji = db.get(`${guildId}.${lastGiveawayId}.emoji`) || ":tada:"

        const channel = interaction.guild.channels.cache.get(currentOptions.channelId);

        const themeColor = db.get(`theme_${interaction.guild.id}`) || "#ffffff"


        if (channel) {
            const embed = new MessageEmbed()
                .setTitle(currentOptions.prize)
                .setDescription(`**Durée :** ${currentOptions.time}\n**Nombre de gagnants :** ${currentOptions.winnersCount}`)
                .setColor(themeColor)



            const participantsButton = new MessageButton()
                .setCustomId('joinGiveaway')
                .setLabel(`Participer (${currentOptions.participants.length})`)
                .setStyle('SECONDARY')
                .setEmoji(emoji || "🎉")

            const actionRow = new MessageActionRow().addComponents(participantsButton);

            const message = await channel.send({ embeds: [embed], components: [actionRow] });

            setTimeout(async () => {
                const updatedOptions = getCurrentOptions(guildId, lastGiveawayId);

                if (updatedOptions.participants.length < updatedOptions.winnersCount) {
                    await channel.send(`Pas assez de participants pour choisir ${updatedOptions.winnersCount} gagnant(s). Le giveaway est annulé.`);
                    return;
                }


                const winners = [];
                while (winners.length < updatedOptions.winnersCount) {
                    const randomIndex = Math.floor(Math.random() * updatedOptions.participants.length);
                    const winnerId = updatedOptions.participants[randomIndex];
                    if (!winners.includes(winnerId)) {
                        winners.push(winnerId);
                    }
                }

                const winnerMentions = winners.map(winnerId => `<@${winnerId}>`).join(', ');
                await channel.send(`Félicitations à ${winnerMentions}, tu as gagné : ${updatedOptions.prize}`);

                db.delete(`${guildId}.${lastGiveawayId}`);
            }, ms(currentOptions.time));
        } else {
            await interaction.reply({ content: 'Le salon spécifié pour le giveaway n\'a pas été trouvé.', ephemeral: true });
        }
    } else if (customId === 'joinGiveaway') {
        const currentOptions = getCurrentOptions(guildId, lastGiveawayId);

        if (currentOptions.participants.includes(user.id)) {

            const emoji = db.get(`${guildId}.${lastGiveawayId}.emoji`) || ":tada:"

            removeParticipant(guildId, lastGiveawayId, user.id);
            const participantsButton = new MessageButton()
                .setCustomId('joinGiveaway')
                .setLabel(`Participer (${currentOptions.participants.length - 1})`)
                .setStyle('SECONDARY')
                .setEmoji(emoji || ":tada:")
            await interaction.deferUpdate();
            await interaction.editReply({ components: [new MessageActionRow().addComponents(participantsButton)] });
        } else {

            const emoji = db.get(`${guildId}.${lastGiveawayId}.emoji`) || ":tada:"
            addParticipant(guildId, lastGiveawayId, user.id);
            const participantsButton = new MessageButton()
                .setCustomId('joinGiveaway')
                .setLabel(`Participer (${currentOptions.participants.length + 1})`)
                .setStyle('SECONDARY')
                .setEmoji(emoji || ":tada:")
            await interaction.deferUpdate();
            await interaction.editReply({ components: [new MessageActionRow().addComponents(participantsButton)] });
        }
    }
});

client.on('messageDelete', async message => {
    const deletedMessage = {
        authorTag: message.author.tag,
        authorAvatar: message.author.displayAvatarURL({ dynamic: true }),
        content: message.content,
        createdAt: message.createdAt,
        attachment: message.attachments.size > 0 ? message.attachments.first().url : null
    };

    await db.set(`deletedMessages_${message.channel.id}`, deletedMessage);
});

client.commands = new Map();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);
}

client.on('messageCreate', message => {
    const guildPrefix = db.get(`prefix_${message.guild.id}`) || DEFAULT_PREFIX;
    
    if (!message.content.startsWith(guildPrefix) || message.author.bot) return;

    const args = message.content.slice(guildPrefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (!client.commands.has(commandName)) return;

    const command = client.commands.get(commandName);

    try {
        command.execute(message, args, client.commands);
    } catch (error) {
        console.error(error);
        
    }
});

const messageCounts = {};


client.on('messageCreate', message => {
    if (message.author.bot || message.system) return;

    const sensitivity = db.get(`antispam_sensitivity_${message.guild.id}`) || 1; 

    const now = Date.now();
    const messageCount = (messageCounts[message.author.id] || 0) + 1;

    messageCounts[message.author.id] = messageCount;

    setTimeout(() => {
        if (messageCounts[message.author.id] === messageCount) {
            delete messageCounts[message.author.id];
        }
    }, 1000);
    if (!message.author.bot && messageCount > sensitivity) {
        message.delete();
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const antilinkType = db.get(`antilink_type_${message.guild.id}`);

    if (!antilinkType) return;

    const links = message.content.match(/(https?|ftp):\/\/[^\s/$.?#].[^\s]*/gi);

    if (links && links.length > 0) {
        if (antilinkType === 'all') {
            message.delete();
        } else if (antilinkType === 'invite') {
            links.forEach(link => {
                if (link.match(/discord(?:app\.com\/invite|\.gg(?:\/invite)?)\/([\w-]{2,255})/i)) {
                    message.delete();
                }
            });
        }
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot || !db.get(`badwords_${message.guild.id}`)) return;

    const badwords = db.get(`badwords_${message.guild.id}`);

    if (!Array.isArray(badwords)) {
        console.error(`Message ignoré - Raison: pas de badwords définit`);
        return;
    }

    const found = badwords.some(word => message.content.toLowerCase().includes(word.toLowerCase()));

    if (found) {
        try {
            await message.delete();
            message.channel.send(`<@${message.author.id}> Votre message a été supprimé car il contenait un mot interdit.`)
  .then(sentMessage => {
    setTimeout(() => {
      sentMessage.delete();
    }, 3000);
  });
        } catch (error) {
        }
    }
});

client.login(config.token);
