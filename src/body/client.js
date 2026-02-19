const mineflayer = require("mineflayer");
const net = require("net")

const bot = mineflayer.createBot(
    {
        host:"localhost",
        username:"BOT"
    }
);

function getBlocks(bot, radius) {
    let blocks = [];
    // 1. Get the bot's position and turn it into whole numbers (integers)
    const botPos = bot.entity.position.floored(); 
    
    // 2. Define the 'half-radius' so the bot is in the dead center
    // If radius is 5, we look from -2 to +2.
    const half = Math.floor(radius / 2); 

    console.log(botPos)

    for (let x = -half; x <= half; x++) {
        for (let y = -half; y <= half; y++) {
            for (let z = -half; z <= half; z++) {
                // 3. Offset from the bot's floored position
                const targetPos = botPos.offset(x, y, z);
                const block = bot.blockAt(targetPos);
                
                blocks.push(block ? block.type : 0);
            }
        }
    }
    return blocks;
}

function getSelfFeatures(bot) {
    return [
        bot.health, 
        bot.food, 
        bot.yaw, 
        bot.pitch, 
        bot.entity.velocity.x,
        bot.entity.velocity.y, 
        bot.entity.velocity.z  
    ]
}

function getHotbarSlots(bot) {

    result = []

    for (let i = 36; i <= 44; i++) {
        const item = bot.inventory.slots[i];
        if (item) {
            result.push(item.count, item.type);
        } else {
            result.push(0, 0); // -1 for 'No Item' as we discussed
        }
    }

    return result
}

function getEntities(bot) {
    let entities = []
    const nearby = Object.values(bot.entities).filter(e => e !== bot.entity).slice(0, 5)
    for (let i = 0; i < 5; i++) {
        const e = nearby[i]
        if (e) {
            entities.push(e.position.x - bot.entity.position.x, e.position.y - bot.entity.position.y, e.position.z - bot.entity.position.z, e.type === 'mob' ? 1 : 0, 1)
        } else {
            entities.push(0, 0, 0, 0, 0)
        }
    }
    return entities
}

function getNeuralFeatures(bot,radius) {
    let blocks = getBlocks(bot, radius)
    let entities = getEntities(bot)

    let self = getSelfFeatures(bot)
    let inventory = getHotbarSlots(bot)

    return [].concat(blocks, entities, self, inventory)
}

function handleKeyboard(bot, actionArray) {
    // 1. WASD + Jump + Sneak + Sprint
    bot.setControlState('forward', actionArray[0] > 0.5);
    bot.setControlState('back',    actionArray[1] > 0.5);
    bot.setControlState('left',    actionArray[2] > 0.5);
    bot.setControlState('right',   actionArray[3] > 0.5);
    bot.setControlState('jump',    actionArray[4] > 0.5);
    bot.setControlState('sneak',   actionArray[5] > 0.5);
    bot.setControlState('sprint',  actionArray[8] > 0.5);
}

function handleInteraction(bot, action) {
    const blockAtCursor = bot.blockAtCursor(5); // 5 blocks is standard reach
    
    // ACTION 6: Left Click (Attack or Mine)
    if (action === 1) {
        const entityAtCursor = bot.entityAtCursor(5);
        if (entityAtCursor) {
            bot.attack(entityAtCursor);
        } else if (blockAtCursor) {
            // bot.dig(block) is asynchronous! 
            // We tell it to start digging the block we're looking at.
            if (bot.canDigBlock(blockAtCursor)) {
                bot.dig(blockAtCursor, true).catch(err => {});
            }
        } else {
            bot.swingArm(); // Just swing at air
        }
    }

    // ACTION 7: Right Click (Place or Use)
    if (action === 2) {
        // If we are looking at a block, try to place a block AGAINST it
        if (blockAtCursor) {
            // bot.placeBlock(referenceBlock, faceVector)
            // This is complex, but start by just 'activating' the block (chests/crafting)
            bot.activateBlock(blockAtCursor).catch(err => {});
        } else {
            bot.activateItem(); // Use whatever is in hand (food/shield)
        }
    }
}

function handleMouse(bot, yaw_delta, pitch_delta) {
    // Delta should be small (e.g., -0.1 to 0.1)
    const newYaw = bot.entity.yaw + yaw_delta
    const newPitch = bot.entity.pitch + pitch_delta
    bot.look(newYaw, newPitch, true) // true = snap instantly
}

function handleAction(bot, KeyboardAction, MouseAction, yaw_delta, pitch_delta) {
    handleKeyboard(bot, KeyboardAction)
    handleInteraction(bot, MouseAction)
    handleMouse(bot, yaw_delta, pitch_delta)
}


const radius = 5

bot.on('spawn', () => {
    console.log("I have spawned!");
    let server = net.createServer((socket) => {
        console.log("Network connected")

        socket.write(JSON.stringify(getNeuralFeatures(bot, radius)) + "\n")
        
        socket.on("data", (data) => {
            try {
                data = JSON.parse(data.toString())

                handleAction(bot, data.slice(0, 9), data[9], data[10], data[11])
                setTimeout(() => {
                    socket.write(getNeuralFeatures(bot, radius))
                }, 100)

            } catch {
                console.log("Error From Network Data")
            }

        })

        socket.on("end", () => {
            console.log("Network disconnected")
        })

        socket.on("error", (err) => {

            console.log("Socket encountered an error: " + err.message);
        });

    })

    server.listen(5500)
});
