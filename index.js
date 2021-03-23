// FIND PACKAGES
const Discord = require('discord.js')
const runClient = new Discord.Client()
// const db = require('quick.db');
const fs = require('fs');
const yaml = require('js-yaml')
const schedule = require('node-schedule');
const { shuffle, randInt, timeConverter } = require('../global/globalUtils.js')


// FETCH UNUSED BUT WORKS FOR FUTURE
const { hypixelFetch, plotzesFetch, fetch } = require('../global/mystFetch.js')

// SETUP CONFIG
let runConfig = yaml.loadAll(fs.readFileSync('config.yaml', 'utf8'))[0]

console.log(runConfig)

const embedColors = {
    green:"#3bcc71",
    red:"#e74c3c",
    blue:"#3498db",
    black:"#000000"
}

var runQueues = {}
var runQueueLimits = {};
runQueues[runConfig.soloChannelID] = []
runQueueLimits[runConfig.soloChannelID] = 1;
var runQueueJoins = {}

async function memberExistsInGuild(guild, id) {
    var exists = true;
    try { await guild.members.fetch(id) } catch { exists = false }
    return exists;
}

/** function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min)
} */

function inGame(player) {
    var gameKeys = Object.keys(runQueues)
    var gamePlayers = []

    for(let i = 0; i < gameKeys.length; i++) {
        gamePlayers = gamePlayers.concat(runQueues[gameKeys[i]])
    }

    return gamePlayers.includes(player)
}

runClient.on('ready', async () => {
    console.log('Bot: TNT Run Server Bot is online!');
    runClient.user.setActivity("TNT Run");

    schedule.scheduleJob('0 */5 * * * *', async function() {
        
        console.log("Updating Run ppl (Kicking inactives)")

        for (user in runQueueJoins) {
            if (Date.now() - runQueueJoins[user][0] > 60 * 60 * 1000) {
                if (runQueues[runQueueJoins[user][1]].includes(user)) {
                    let runChannel = await runClient.channels.fetch(runQueueJoins[user][1])
                    runChannel.send(`<@!${user}> was removed from the queue after remaining in it for over an hour`)
                    var removeID = user
                    runQueues[runChannel.id].splice(runQueues[runChannel.id].indexOf(removeID), 1)
                    delete runQueueJoins[user]
                }
            }
        }
    })
});

const prefix = "="
runClient.on('message', async m => {

    //console.log(m)

    if(m.author.bot) return;

    if(!m.content.startsWith(prefix)) return

    var args = m.content.toLowerCase().slice(prefix.length).split(' ');
    const command = args.shift().toLowerCase()

    console.log(m.author.username+": " + m.content)
    if (command == "help") {

        if (m.member.roles.cache.has(runConfig.adminRoleID) || m.member.roles.cache.has(runConfig.moderatorRoleID)) {
            return m.channel.send(new Discord.MessageEmbed()
            .setColor(embedColors.blue)
            .setTitle('**Help Menu**')
            .setDescription(`**${prefix}join or ${prefix}j** - Join the queue of the lobby you are in
    **${prefix}leave or ${prefix}l** - Leave the queue
    **${prefix}queue or ${prefix}q** - See who is in this queue
    
    **Staff-only Commands**
    **${prefix}forcejoin {user mention}** - Forces a user to join that game
    **${prefix}forcekick {user mention}** - Force Kicks a user out of that game`)
            .setTimestamp()
            .setFooter("TNT Run Bot created by Mysterium_"))
        }
        else {
            return m.channel.send(new Discord.MessageEmbed()
            .setColor(embedColors.blue)
            .setTitle('**Help Menu**')
            .setDescription(`**${prefix}join or ${prefix}j** - Join the queue of the lobby you are in
    **${prefix}leave or ${prefix}l** - Leave the queue
    **${prefix}queue or ${prefix}q** - See who is in this queue`)
            .setTimestamp()
            .setFooter("TNT Run Bot created by Mysterium_"))
        }
    }

    let runChannels = [runConfig.soloChannelID]
    if (!runChannels.includes(m.channel.id)) return;
    if (command == 'queue' || command == 'q') {
        if(runQueues[m.channel.id].length == 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.red)
                .setDescription("No one in this queue"))
        }

        var queueResponse = ""
        for (let i = 0; i < runQueues[m.channel.id].length; i++) {
            queueResponse = `${queueResponse}<@!${runQueues[m.channel.id][i]}>\n`
        }
        return m.channel.send(new Discord.MessageEmbed()
            .setColor(embedColors.blue)
            .setTitle(`**Game Queue** [${runQueues[m.channel.id].length}/${runQueueLimits[m.channel.id]*2}]`)
            .setDescription(`Creator: ${queueResponse}`))
    }
    else if (command == 'join' || command == 'j') {

        if (args.length > 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Too many args: Use just ${prefix}j`))
        }
        if(inGame(m.author.id)) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("You are already in a game"))
        }

        runQueues[m.channel.id].push(m.author.id)
        runQueueJoins[m.author.id] = [Date.now(), m.channel.id]

        if (runQueues[m.channel.id].length == 1) {
            m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`[${runQueues[m.channel.id].length}/${runQueueLimits[m.channel.id]*2}] <@!${m.author.id}> created a new game.`))
        }
        else {
            m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`[${runQueues[m.channel.id].length}/${runQueueLimits[m.channel.id]*2}] <@!${m.author.id}> joined the game.`))
        }

        if(runQueues[m.channel.id].length > runQueueLimits[m.channel.id]*2-1) {
            let gameCounters = await JSON.parse(fs.readFileSync('runGameCounts.json'))
            gameCounters[m.channel.id] = gameCounters[m.channel.id] + 1
            fs.writeFileSync('runGameCounts.json', JSON.stringify(gameCounters))

            let outputPingText = "";
            for (let j = 0; j < runQueues[m.channel.id].length; j++) {
                outputPingText = `${outputPingText}<@!${runQueues[m.channel.id][j]}> `
            }

            runQueues[m.channel.id] = []
            return m.channel.send(outputPingText, {embed: new Discord.MessageEmbed()
                .setColor(embedColors.blue)
                .setTitle(`Game #${gameCounters[m.channel.id]}`)
                .setDescription(`**Creation Time:** ${timeConverter(Math.floor(Date.now()))}\n**Lobby:** <#${m.channel.id}>`)
                .addField('**Team 1**', `<@!${runQueues[m.channel.id][0]}>`)
                .addField('**Team 2**', `<@!${runQueues[m.channel.id][1]}>`)
            })
        }
    }
    else if (command == "leave" || command == "l") {
        if (args.length > 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Too many args: Use just ${prefix}l`))
        }

        if(!inGame(m.author.id)) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`You are not in any game`))
        }

        if (runQueues[m.channel.id].indexOf(m.author.id) > -1) {
            runQueues[m.channel.id].splice(runQueues[m.channel.id].indexOf(m.author.id), 1)
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.red)
                .setDescription(`[${runQueues[m.channel.id].length}/${runQueueLimits[m.channel.id]*2}] <@!${m.author.id}> has left the game.`))
        }
        else {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`You are not in this game`))
        }
    }
    else if (command == "forcejoin") {

        if (!(m.member.roles.cache.has(runConfig.adminRoleID) || m.member.roles.cache.has(runConfig.moderatorRoleID) || m.member.roles.cache.has(runConfig.helperRoleID))) {
            return;
        }

        if (m.mentions.members.size == 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("Please mention the user you are attempting to force-join"))
        }

        if (m.mentions.members.size > 1) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("I can only force-join one user at a time"))
        }

        pinged = m.mentions.members.first()

        if (pinged.user.bot) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Bots can't join/leave games!`))
        }

        if(inGame(pinged.id)) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Player <@!${pinged.id}> is already in a game`))
        }

        runQueues[m.channel.id].push(pinged.id)
        runQueueJoins[pinged.id] = [Date.now(), m.channel.id]

        if (runQueues[m.channel.id].length == 1) {
            m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`[${runQueues[m.channel.id].length}/${runQueueLimits[m.channel.id]*2}] <@!${pinged.id}> created a new game.`))
        }
        else {
            m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.green)
                .setDescription(`[${runQueues[m.channel.id].length}/${runQueueLimits[m.channel.id]*2}] <@!${pinged.id}> joined the game.`))
        }

        if(runQueues[m.channel.id].length > runQueueLimits[m.channel.id]*2-1) {
            let gameCounters = await JSON.parse(fs.readFileSync('runGameCounts.json'))
            gameCounters[m.channel.id] = gameCounters[m.channel.id] + 1
            fs.writeFileSync('runGameCounts.json', JSON.stringify(gameCounters))

            let outputPingText = "";
            for (let j = 0; j < runQueues[m.channel.id].length; j++) {
                outputPingText = `${outputPingText}<@!${runQueues[m.channel.id][j]}> `
            }

            
            m.channel.send(outputPingText, {embed: new Discord.MessageEmbed()
                .setColor(embedColors.blue)
                .setTitle(`Game #${gameCounters[m.channel.id]}`)
                .setDescription(`**Creation Time:** ${timeConverter(Math.floor(Date.now()))}\n**Lobby:** <#${m.channel.id}>`)
                .addField('**Team 1**', `<@!${runQueues[m.channel.id][0]}>`)
                .addField('**Team 2**', `<@!${runQueues[m.channel.id][1]}>`)})
            return runQueues[m.channel.id] = []
        }        
    }

    else if (command == "forcekick") {

        if (!(m.member.roles.cache.has(runConfig.adminRoleID) || m.member.roles.cache.has(runConfig.moderatorRoleID) || m.member.roles.cache.has(runConfig.helperRoleID))) {
            return;
        }

        if (m.mentions.members.size == 0) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("Please mention the user you are attempting to force-kick"))
        }

        if (m.mentions.members.size > 1) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription("I can only force-kick one user at a time"))
        }

        pinged = m.mentions.members.first()

        if (pinged.user.bot) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Bots can't join/leave games!`))
        }

        if(!inGame(pinged.id)) {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`Player <@!${pinged.id}> is not in any game`))
        }

        if (runQueues[m.channel.id].indexOf(pinged.id) > -1) {
            runQueues[m.channel.id].splice(runQueues[m.channel.id].indexOf(pinged.id), 1)
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.red)
                .setDescription(`[${runQueues[m.channel.id].length}/${runQueueLimits[m.channel.id]*2}] <@!${pinged.id}> has left the game.`))
        }
        else {
            return m.channel.send(new Discord.MessageEmbed()
                .setColor(embedColors.black)
                .setDescription(`You are not in this game`))
        }
    }
})

runClient.login(runConfig.RunBotToken);