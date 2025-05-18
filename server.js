const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game constants
const PLAYER_RADIUS = 15;
const BALL_RADIUS = 10;
const FENCE_WIDTH = 45;
const GOAL_WIDTH = 100;
const GOAL_DEPTH = 40;
const DEFAULT_FIELD_WIDTH = 1000;
const DEFAULT_FIELD_HEIGHT = 600;
const EXACT_WIDTH = 1160;
const EXACT_HEIGHT = 810;
const EXACT_CENTER_X = 580;
const EXACT_CENTER_Y = 405;
const LEFT_FENCE = EXACT_CENTER_X - (EXACT_WIDTH / 2) + FENCE_WIDTH;
const RIGHT_FENCE = EXACT_CENTER_X + (EXACT_WIDTH / 2) - FENCE_WIDTH;


// Game state
const gameState = {
    rooms: {},
    players: {}
};

// Create a new room
function createRoom(roomId, hostId) {
    gameState.rooms[roomId] = {
        id: roomId,
        hostId: hostId,
        players: {},
        teams: {
            red: [],
            blue: [],
            spectator: []
        },
        score: {
            red: 0,
            blue: 0
        },
        ball: {
            x: EXACT_CENTER_X,
            y: EXACT_CENTER_Y,
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS
        },
        gameActive: false,
        kickoff: false,
        kickoffTeam: null,
        lastTouched: null,
        settings: {
            startingTeam: 'random',
            gameDuration: 5 // minutes
        },
        // Field dimensions with exact values
        fieldWidth: EXACT_WIDTH,
        fieldHeight: EXACT_HEIGHT,
        // Playable area with exact values
        playableArea: {
            left: LEFT_FENCE,
            right: RIGHT_FENCE,
            top: 0,
            bottom: EXACT_HEIGHT,
            centerX: EXACT_CENTER_X,
            centerY: EXACT_CENTER_Y
        }
    };
    return gameState.rooms[roomId];
}

// Player join room
function joinRoom(roomId, playerId, playerName) {
    const room = gameState.rooms[roomId];
    if (!room) return null;
    
    // Add player to room
    room.players[playerId] = {
        id: playerId,
        name: playerName,
        team: 'spectator',
        isBot: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: PLAYER_RADIUS,
        damping: 0.92
    };
    
    // Add to spectator team
    room.teams.spectator.push(room.players[playerId]);
    
    return room;
}

// Player leave room
function leaveRoom(roomId, playerId) {
    const room = gameState.rooms[roomId];
    if (!room) return;
    
    // Remove from team
    const player = room.players[playerId];
    if (player) {
        const team = player.team;
        room.teams[team] = room.teams[team].filter(p => p.id !== playerId);
    }
    
    // Remove player from room
    delete room.players[playerId];
    
    // If room is empty, delete it
    if (Object.keys(room.players).length === 0) {
        delete gameState.rooms[roomId];
    } else if (room.hostId === playerId) {
        // If host leaves, assign new host
        const newHostId = Object.keys(room.players)[0];
        room.hostId = newHostId;
        io.to(roomId).emit('new-host', newHostId);
    }
}

// Move player to team
function movePlayerToTeam(roomId, playerId, newTeam) {
    const room = gameState.rooms[roomId];
    if (!room) return;
    
    const player = room.players[playerId];
    if (!player) return;
    
    // Remove from current team
    const currentTeam = player.team;
    room.teams[currentTeam] = room.teams[currentTeam].filter(p => p.id !== playerId);
    
    // Add to new team
    player.team = newTeam;
    room.teams[newTeam].push(player);
    
    // Notify room
    io.to(roomId).emit('teams-updated', room.teams);
}

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    
    // Player joins the game
    socket.on('join-game', (playerName) => {
        gameState.players[socket.id] = {
            id: socket.id,
            name: playerName,
            currentRoom: null
        };
        
        console.log(`Player ${playerName} (${socket.id}) joined the game`);
        socket.emit('joined-game', socket.id);
    });
    
    // Create a new room
    socket.on('create-room', () => {
        const player = gameState.players[socket.id];
        if (!player) return;
        
        const roomId = generateRoomId();
        const room = createRoom(roomId, socket.id);
        
        // Join the room
        socket.join(roomId);
        player.currentRoom = roomId;
        
        // Join as player in the room
        joinRoom(roomId, socket.id, player.name);
        
        console.log(`Room ${roomId} created by ${player.name}`);
        socket.emit('room-created', roomId);
        socket.emit('room-joined', {
            roomId: roomId,
            players: room.players,
            teams: room.teams,
            isHost: true
        });
    });
    
    // Join existing room
    socket.on('join-room', (roomId) => {
        const player = gameState.players[socket.id];
        if (!player) return;
        
        const room = gameState.rooms[roomId];
        if (!room) {
            socket.emit('error', 'Room not found');
            return;
        }
        
        // Join the room
        socket.join(roomId);
        player.currentRoom = roomId;
        
        // Join as player in the room
        joinRoom(roomId, socket.id, player.name);
        
        console.log(`Player ${player.name} joined room ${roomId}`);
        socket.emit('room-joined', {
            roomId: roomId,
            players: room.players,
            teams: room.teams,
            isHost: room.hostId === socket.id
        });
        
        // Notify other players
        socket.to(roomId).emit('player-joined', {
            playerId: socket.id,
            playerName: player.name,
            players: room.players,
            teams: room.teams
        });
    });
    
    // Change team
    socket.on('change-team', (newTeam) => {
        const player = gameState.players[socket.id];
        if (!player || !player.currentRoom) return;
        
        movePlayerToTeam(player.currentRoom, socket.id, newTeam);
    });
    
    // Move player (host moves player to team)
    socket.on('move-player', (data) => {
        const player = gameState.players[socket.id];
        if (!player || !player.currentRoom) return;
        
        const room = gameState.rooms[player.currentRoom];
        if (room.hostId !== socket.id) return; // Only host can move players
        
        movePlayerToTeam(player.currentRoom, data.playerId, data.team);
    });
    
    // Update game settings
    socket.on('update-settings', (settings) => {
        const player = gameState.players[socket.id];
        if (!player || !player.currentRoom) return;
        
        const room = gameState.rooms[player.currentRoom];
        if (room.hostId !== socket.id) return; // Only host can update settings
        
        room.settings = {
            ...room.settings,
            ...settings
        };
        
        // Notify all players in room
        io.to(player.currentRoom).emit('settings-updated', room.settings);
    });
    
    // Update canvas size
    socket.on('canvas-size', (size) => {
        const player = gameState.players[socket.id];
        if (!player || !player.currentRoom) return;
        
        const room = gameState.rooms[player.currentRoom];
        
        // ALWAYS use our exact hardcoded values regardless of what client reports
        room.fieldWidth = EXACT_WIDTH;
        room.fieldHeight = EXACT_HEIGHT;
        
        // Update playable area with exact hardcoded values
        room.playableArea = {
            left: LEFT_FENCE,
            right: RIGHT_FENCE,
            top: 0,
            bottom: EXACT_HEIGHT,
            centerX: EXACT_CENTER_X,
            centerY: EXACT_CENTER_Y
        };
        
        console.log(`Using exact field dimensions: ${EXACT_WIDTH}x${EXACT_HEIGHT}`);
        console.log(`Field center: (${EXACT_CENTER_X}, ${EXACT_CENTER_Y})`);
        console.log(`Playable area: [${LEFT_FENCE}, ${0}] to [${RIGHT_FENCE}, ${EXACT_HEIGHT}]`);
        
        // If game is active, reset positions to match the exact values
        if (room.gameActive) {
            // Reset ball to exact center
            room.ball.x = EXACT_CENTER_X;
            room.ball.y = EXACT_CENTER_Y;
            
            // Reposition players
            positionPlayers(room);
        }
    });
    
    // Start game
    socket.on('start-game', () => {
        const player = gameState.players[socket.id];
        if (!player || !player.currentRoom) return;
        
        const room = gameState.rooms[player.currentRoom];
        if (room.hostId !== socket.id) return; // Only host can start game
        
        // Check if there are players in each team
        if (room.teams.red.length === 0 || room.teams.blue.length === 0) {
            socket.emit('error', 'Need at least one player in each team');
            return;
        }
        
        // Initialize game
        room.gameActive = true;
        room.score = { red: 0, blue: 0 };
        
        // Initialize ball exactly at the center
        room.ball = {
            x: EXACT_CENTER_X,
            y: EXACT_CENTER_Y,
            vx: 0,
            vy: 0,
            radius: BALL_RADIUS
        };
        
        // Position players using exact coordinates
        positionPlayers(room);
        
        // Determine starting team
        if (room.settings.startingTeam === 'random') {
            room.kickoffTeam = Math.random() < 0.5 ? 'red' : 'blue';
        } else {
            room.kickoffTeam = room.settings.startingTeam;
        }
        
        room.kickoff = true;
    room.kickoffRestrictions = true; // Add this line
    
    // Notify all players that game is starting
    io.to(player.currentRoom).emit('game-started', {
        ball: room.ball,
        players: room.players,
        score: room.score,
        kickoffTeam: room.kickoffTeam
    });
    
    // Start kickoff countdown
    io.to(player.currentRoom).emit('kickoff-countdown', {
        kickoffTeam: room.kickoffTeam
    });
});
socket.on('kickoff-countdown-complete', () => {
    const player = gameState.players[socket.id];
    if (!player || !player.currentRoom) return;
    
    const room = gameState.rooms[player.currentRoom];
    if (!room || !room.gameActive || !room.kickoff) return;
    
    // Only accept this from the host
    if (room.hostId !== socket.id) return;
    
    // End kickoff
    room.kickoff = false;
    
    // Note: kickoffRestrictions remains true until ball is touched
    io.to(player.currentRoom).emit('kickoff-complete');
    
    console.log(`Kickoff countdown complete in room ${player.currentRoom}`);
});
    
    // Player input
    socket.on('player-input', (input) => {
        const player = gameState.players[socket.id];
        if (!player || !player.currentRoom) return;
        
        const room = gameState.rooms[player.currentRoom];
        if (!room.gameActive) return;
        
        const gamePlayer = room.players[socket.id];
        if (!gamePlayer) return;
        
        // Update player input
        gamePlayer.input = input;
    });
    
    // Chat message
    socket.on('chat-message', (data) => {
        const player = gameState.players[socket.id];
        if (!player || !player.currentRoom) return;
        
        // Send message to all players in room
        io.to(player.currentRoom).emit('chat-message', {
            sender: player.name,
            message: data.message
        });
    });
    
    // Leave game
    socket.on('leave-game', () => {
        const player = gameState.players[socket.id];
        if (player && player.currentRoom) {
            leaveRoom(player.currentRoom, socket.id);
            
            // Notify room
            socket.to(player.currentRoom).emit('player-left', socket.id);
            
            // Leave socket.io room
            socket.leave(player.currentRoom);
            player.currentRoom = null;
        }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        const player = gameState.players[socket.id];
        if (player && player.currentRoom) {
            leaveRoom(player.currentRoom, socket.id);
            
            // Notify room
            io.to(player.currentRoom).emit('player-left', socket.id);
        }
        
        delete gameState.players[socket.id];
        console.log(`Player disconnected: ${socket.id}`);
    });
});

// Position players on the field using playable area
function positionPlayers(room) {
    console.log("Positioning players using exact coordinates");
    
    // Position red team on left side
    room.teams.red.forEach((playerRef, index) => {
        const gamePlayer = room.players[playerRef.id];
        if (gamePlayer) {
            // Position in left quarter of playable area
            gamePlayer.x = LEFT_FENCE + (RIGHT_FENCE - LEFT_FENCE) / 4;
            gamePlayer.y = EXACT_CENTER_Y + (index - (room.teams.red.length - 1) / 2) * 50;
            gamePlayer.vx = 0;
            gamePlayer.vy = 0;
            gamePlayer.damping = 0.92;
            
            console.log(`Red player positioned at: (${gamePlayer.x}, ${gamePlayer.y})`);
        }
    });
    
    // Position blue team on right side
    room.teams.blue.forEach((playerRef, index) => {
        const gamePlayer = room.players[playerRef.id];
        if (gamePlayer) {
            // Position in right quarter of playable area
            gamePlayer.x = RIGHT_FENCE - (RIGHT_FENCE - LEFT_FENCE) / 4;
            gamePlayer.y = EXACT_CENTER_Y + (index - (room.teams.blue.length - 1) / 2) * 50;
            gamePlayer.vx = 0;
            gamePlayer.vy = 0;
            gamePlayer.damping = 0.92;
            
            console.log(`Blue player positioned at: (${gamePlayer.x}, ${gamePlayer.y})`);
        }
    });
}

// Game physics update
// In server.js, replace the updateGame function with this version
// that consistently uses playableArea for ALL boundary checks

function updateGame(room) {
    if (!room.gameActive || room.kickoff) return;
    
    const playableArea = room.playableArea;
    if (!playableArea) {
        console.error("Error: playableArea not defined for room");
        return;
    }
    if (!room.gameActive) return;
    
    // Special handling during kickoff
    if (room.kickoff || room.kickoffRestrictions) {
        // If kickoff countdown is complete but ball hasn't been touched
        if (!room.kickoff && room.kickoffRestrictions) {
            // Check if ball has been touched by kickoff team
            if (Math.abs(room.ball.vx) > 0.1 || Math.abs(room.ball.vy) > 0.1) {
                // Ball has moved, end kickoff restrictions
                room.kickoffRestrictions = false;
                io.to(room.id).emit('kickoff-restrictions-end');
                console.log("Kickoff restrictions ended, ball in play");
            }
        }
    }
    
    // Update player positions based on input
    Object.values(room.players).forEach(player => {
        if (player.team === 'spectator') return;
        
        // Get input if available
        if (player.input) {
            const { left, right, up, down, shoot } = player.input;

            // Apply kickoff restrictions
            if (room.kickoff || room.kickoffRestrictions) {
                const isKickoffTeam = player.team === room.kickoffTeam;
                const CENTER_CIRCLE_RADIUS = 60; // Match visual center circle
                
                // Enforce kickoff restrictions
                if (!isKickoffTeam) {
                    // Non-kickoff team can't enter center circle
                    const distToCenter = getDistance(player.x, player.y, EXACT_CENTER_X, EXACT_CENTER_Y);
                    if (distToCenter < CENTER_CIRCLE_RADIUS) {
                        // Calculate angle from center to player
                        const angle = Math.atan2(player.y - EXACT_CENTER_Y, player.x - EXACT_CENTER_X);
                        
                        // Smooth push out with slight bounce
                        player.x = EXACT_CENTER_X + Math.cos(angle) * (CENTER_CIRCLE_RADIUS + player.radius + 0.1);
                        player.y = EXACT_CENTER_Y + Math.sin(angle) * (CENTER_CIRCLE_RADIUS + player.radius + 0.1);
                        
                        // Bounce with reduced velocity (30% of original)
                        const dot = player.vx * Math.cos(angle) + player.vy * Math.sin(angle);
                        player.vx -= 0.6 * dot * Math.cos(angle);
                        player.vy -= 0.6 * dot * Math.sin(angle);
                        
                        // Add slight perpendicular velocity to prevent sticking
                        const perpAngle = angle + Math.PI/2;
                        player.vx += Math.cos(perpAngle) * 0.1;
                        player.vy += Math.sin(perpAngle) * 0.1;
                    }
                }
                
                // For midline collision in kickoff (both for kickoff team and non-kickoff team):
                if ((player.team === 'red' && player.x > EXACT_CENTER_X) ||
                    (player.team === 'blue' && player.x < EXACT_CENTER_X)) {
                    
                    // Position player just to their side of midline with slight offset
                    if (player.team === 'red') {
                        player.x = EXACT_CENTER_X - player.radius - 0.2;
                    } else {
                        player.x = EXACT_CENTER_X + player.radius + 0.2;
                    }
                    
                    // Bounce with reduced velocity
                    player.vx = -player.vx * 0.3;
                    
                    // Add slight y velocity to prevent sticking
                    player.vy += (Math.random() - 0.5) * 0.2;
                } else {
                    // KICKOFF TEAM ALSO can't cross midline until ball is touched
                    if ((player.team === 'red' && player.x > EXACT_CENTER_X) ||
                        (player.team === 'blue' && player.x < EXACT_CENTER_X)) {
                        // Push back to own half
                        if (player.team === 'red') {
                            player.x = EXACT_CENTER_X - 1;
                        } else {
                            player.x = EXACT_CENTER_X + 1;
                        }
                        player.vx = 0;
                    }
                }
            }
            
            // Calculate x and y direction
            let dx = 0, dy = 0;
            if (left) dx -= 1;
            if (right) dx += 1;
            if (up) dy -= 1;
            if (down) dy += 1;
            
            // Normalize diagonal movement
            if (dx !== 0 && dy !== 0) {
                const length = Math.sqrt(dx * dx + dy * dy);
                dx /= length;
                dy /= length;
            }
            
            // Apply movement with acceleration
             // Apply movement with improved physics
        const PLAYER_BASE_SPEED = 3.5;
        const PLAYER_ACCELERATION = 0.25; // Slightly reduced for smoother acceleration
        const PLAYER_MAX_SPEED = 4.2;     // Slightly increased for better feel
        
        // We'll have different movement parameters for active vs. sliding motion
        if (dx !== 0 || dy !== 0) {
            // ACTIVE MOVEMENT: Player is pressing keys
            
            // Set active movement mode
            player.isActivelyMoving = true;
            player.lastActiveTime = Date.now();
            
            // Target velocity based on input direction
            const targetVx = dx * PLAYER_BASE_SPEED;
            const targetVy = dy * PLAYER_BASE_SPEED;
            
            // Smoothly approach target velocity
            player.vx += (targetVx - player.vx) * PLAYER_ACCELERATION;
            player.vy += (targetVy - player.vy) * PLAYER_ACCELERATION;
            
            // Cap at maximum speed
            const currentSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
            if (currentSpeed > PLAYER_MAX_SPEED) {
                const scale = PLAYER_MAX_SPEED / currentSpeed;
                player.vx *= scale;
                player.vy *= scale;
            }
            
            // When actively moving, use constant damping value
            player.damping = 0.92;
        } else {
            // SLIDING MOVEMENT: No keys pressed, player is sliding
            
            // Set sliding mode
            player.isActivelyMoving = false;
            
            // Apply dynamic damping for natural deceleration
            // The physics here is critical for smooth sliding
            
            // Calculate time-based friction
            const timeSinceActive = Date.now() - (player.lastActiveTime || 0);
            
            // Sliding friction increases slightly over time
            // This creates a more natural motion where the player 
            // initially glides and then gradually slows down
            
            // Calculate sliding friction factor
            let slidingFriction;
            if (timeSinceActive < 100) {
                // Just started sliding - low friction
                slidingFriction = 0.93; // High value = more slippery
            } else if (timeSinceActive < 300) {
                // Sliding for a bit - medium friction
                slidingFriction = 0.92;
            } else if (timeSinceActive < 600) {
                // Sliding longer - increasing friction
                slidingFriction = 0.90;
            } else {
                // Long slide - higher friction to stop
                slidingFriction = 0.88;
            }
            
            // Apply the sliding friction
            player.damping = slidingFriction;
            
            // Apply minimum velocity threshold to prevent jittery tiny movements
            // When speed gets very low, just stop completely
            const currentSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
            if (currentSpeed < 0.05) {
                player.vx = 0;
                player.vy = 0;
            }
        }
            
            // Handle shooting
            if (shoot) {
                const ball = room.ball;
                const distToBall = getDistance(player.x, player.y, ball.x, ball.y);
                
                if (distToBall < player.radius + ball.radius + 5) {
                    // Calculate shooting direction
                    let shootDx = 0;
                    let shootDy = 0;
                    
                    // If player is moving, shoot in movement direction
                    if (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1) {
                        const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
                        shootDx = player.vx / speed;
                        shootDy = player.vy / speed;
                    } else {
                        // If player is not moving, shoot away from player position
                        shootDx = ball.x - player.x;
                        shootDy = ball.y - player.y;
                        const dist = Math.sqrt(shootDx * shootDx + shootDy * shootDy);
                        if (dist > 0) {
                            shootDx /= dist;
                            shootDy /= dist;
                        }
                    }
                    
                    // Apply shooting power
                    const SHOOT_POWER = 8;
                    ball.vx = shootDx * SHOOT_POWER;
                    ball.vy = shootDy * SHOOT_POWER;
                    
                    // Record last touched
                    room.lastTouched = player.id;
                }
            }
        }
        const nextX = player.x + player.vx;
    const nextY = player.y + player.vy;
    
    // Check for collisions before updating position
    // This prevents the player from clipping through walls
    let collided = false;
    
    // Check if the next position would cause a collision
    // If not, move normally
    if (!wouldCollideWithWall(nextX, nextY, player.radius, room.playableArea)) {
        player.x = nextX;
        player.y = nextY;
    } else {
        // Handle collision with improved physics
        handleImprovedCollision(player, room.playableArea);
        collided = true;
    }
    
    // Apply appropriate damping based on player state
    player.vx *= player.damping || 0.92;
    player.vy *= player.damping || 0.92;
    
    // Stop very small movements to prevent jittering
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
    if (Math.abs(player.vy) < 0.05) player.vy = 0;
    });
    
    // Update player positions
    Object.values(room.players).forEach(player => {
        if (player.team === 'spectator') return;
        
        // Update position
        player.x += player.vx;
        player.y += player.vy;
        
        // Apply appropriate damping based on player state
        player.vx *= player.damping || 0.92;
        player.vy *= player.damping || 0.92;
        
        // Stop very small movements to prevent jittering
        if (Math.abs(player.vx) < 0.05) player.vx = 0;
        if (Math.abs(player.vy) < 0.05) player.vy = 0;
        
        // Handle wall collisions
        // Top and bottom walls
        if (player.y < player.radius) {
            handleSmoothCollision(player, 0, 'y', 1); // 1 means positive direction (away from top)
        }
        // Bottom wall
        if (player.y > playableArea.bottom - player.radius) {
            handleSmoothCollision(player, playableArea.bottom, 'y', -1); // -1 means negative direction (away from bottom)
        }
        // Left fence
        if (player.x < playableArea.left + player.radius && 
            (player.y < playableArea.centerY - GOAL_WIDTH / 2 || 
             player.y > playableArea.centerY + GOAL_WIDTH / 2)) {
            handleSmoothCollision(player, playableArea.left, 'x', 1);
        }
        // Right fence
        if (player.x > playableArea.right - player.radius && 
            (player.y < playableArea.centerY - GOAL_WIDTH / 2 || 
             player.y > playableArea.centerY + GOAL_WIDTH / 2)) {
            handleSmoothCollision(player, playableArea.right, 'x', -1);
        }
        
        // Goal back walls - using playableArea values to be consistent
        if (player.x < 0 + player.radius && 
            player.y > playableArea.centerY - GOAL_WIDTH / 2 && 
            player.y < playableArea.centerY + GOAL_WIDTH / 2) {
            player.x = 0 + player.radius;
            player.vx = -player.vx * 0.5;
        }
        
        if (player.x > playableArea.right + FENCE_WIDTH - player.radius && 
            player.y > playableArea.centerY - GOAL_WIDTH / 2 && 
            player.y < playableArea.centerY + GOAL_WIDTH / 2) {
            player.x = playableArea.right + FENCE_WIDTH - player.radius;
            player.vx = -player.vx * 0.5;
        }
    });
    
    // Update ball position
    const ball = room.ball;
    ball.x += ball.vx;
    ball.y += ball.vy;
    
    // Apply ball damping
    const BALL_DAMPING = 0.98;
    ball.vx *= BALL_DAMPING;
    ball.vy *= BALL_DAMPING;
    
    // Ball collision with walls
    // Top and bottom walls
    if (ball.y < ball.radius) {
        ball.y = ball.radius;
        ball.vy = -ball.vy * 0.7;
    }
    if (ball.y > playableArea.bottom - ball.radius) {
        ball.y = playableArea.bottom - ball.radius;
        ball.vy = -ball.vy * 0.7;
    }
    
    // Left and right walls (excluding goal areas)
    // Left fence excluding goal
    if (ball.x < playableArea.left + ball.radius && 
        (ball.y < playableArea.centerY - GOAL_WIDTH / 2 || 
         ball.y > playableArea.centerY + GOAL_WIDTH / 2)) {
        ball.x = playableArea.left + ball.radius;
        ball.vx = -ball.vx * 0.7;
    }
    
    // Right fence excluding goal
    if (ball.x > playableArea.right - ball.radius && 
        (ball.y < playableArea.centerY - GOAL_WIDTH / 2 || 
         ball.y > playableArea.centerY + GOAL_WIDTH / 2)) {
        ball.x = playableArea.right - ball.radius;
        ball.vx = -ball.vx * 0.7;
    }
    
    // Goal back walls - consistently using playableArea
    if (ball.x < 0 + ball.radius && 
        ball.y > playableArea.centerY - GOAL_WIDTH / 2 && 
        ball.y < playableArea.centerY + GOAL_WIDTH / 2) {
        ball.x = 0 + ball.radius;
        ball.vx = -ball.vx * 0.7;
    }
    
    if (ball.x > playableArea.right + FENCE_WIDTH - ball.radius && 
        ball.y > playableArea.centerY - GOAL_WIDTH / 2 && 
        ball.y < playableArea.centerY + GOAL_WIDTH / 2) {
        ball.x = playableArea.right + FENCE_WIDTH - ball.radius;
        ball.vx = -ball.vx * 0.7;
    }
    
    // Check for player-ball collisions
    Object.values(room.players).forEach(player => {
        if (player.team === 'spectator') return;
        
        const dx = ball.x - player.x;
        const dy = ball.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < player.radius + ball.radius) {
            // Set last touched
            room.lastTouched = player.id;
            
            // Calculate collision response
            const nx = dx / distance;
            const ny = dy / distance;
            
            // Move ball outside of player
            const overlap = player.radius + ball.radius - distance;
            ball.x += nx * overlap;
            ball.y += ny * overlap;
            
            // Apply impulse to ball
            ball.vx += nx * Math.abs(player.vx) * 0.8;
            ball.vy += ny * Math.abs(player.vy) * 0.8;
            
            // Ensure ball has some velocity away from player
            const minVelocity = 1;
            const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (ballSpeed < minVelocity) {
                ball.vx += nx * minVelocity;
                ball.vy += ny * minVelocity;
            }
        }
    });
    
    // Check for player-player collisions
    const players = Object.values(room.players).filter(p => p.team !== 'spectator');
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            const p1 = players[i];
            const p2 = players[j];
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < p1.radius + p2.radius) {
                // Calculate collision normal
                const nx = dx / distance;
                const ny = dy / distance;
                
                // Calculate overlap
                const overlap = (p1.radius + p2.radius - distance) / 2;
                
                // Move players away from each other
                p1.x -= nx * overlap;
                p1.y -= ny * overlap;
                p2.x += nx * overlap;
                p2.y += ny * overlap;
                
                // Exchange velocity components
                const p1vx = p1.vx;
                const p1vy = p1.vy;
                const p2vx = p2.vx;
                const p2vy = p2.vy;
                
                p1.vx = p2vx * 0.5;
                p1.vy = p2vy * 0.5;
                p2.vx = p1vx * 0.5;
                p2.vy = p1vy * 0.5;
            }
        }
    }
    
    // Check for goals - using ONLY playableArea values for consistency
    // Left goal (blue scores)
    if (ball.x - ball.radius <= playableArea.left && 
        ball.vx < 0 &&  // Ball must be moving leftward
        ball.y > playableArea.centerY - GOAL_WIDTH / 2 && 
        ball.y < playableArea.centerY + GOAL_WIDTH / 2) {
        // Goal for blue team
        scoreGoal(room, 'blue');
    }
    
    // Right goal (red scores)
    if (ball.x + ball.radius >= playableArea.right && 
        ball.vx > 0 &&  // Ball must be moving rightward
        ball.y > playableArea.centerY - GOAL_WIDTH / 2 && 
        ball.y < playableArea.centerY + GOAL_WIDTH / 2) {
        // Goal for red team
        scoreGoal(room, 'red');
    }
}
function wouldCollideWithWall(x, y, radius, playableArea) {
    // Check top and bottom walls
    if (y - radius < 0 || y + radius > playableArea.bottom) {
        return true;
    }
    
    // Check left fence (excluding goal)
    if (x - radius < playableArea.left && 
        (y < playableArea.centerY - GOAL_WIDTH / 2 || y > playableArea.centerY + GOAL_WIDTH / 2)) {
        return true;
    }
    
    // Check right fence (excluding goal)
    if (x + radius > playableArea.right && 
        (y < playableArea.centerY - GOAL_WIDTH / 2 || y > playableArea.centerY + GOAL_WIDTH / 2)) {
        return true;
    }
    
    // Check goal back walls
    if (x - radius < 0 && 
        y > playableArea.centerY - GOAL_WIDTH / 2 && 
        y < playableArea.centerY + GOAL_WIDTH / 2) {
        return true;
    }
    
    if (x + radius > playableArea.right + FENCE_WIDTH && 
        y > playableArea.centerY - GOAL_WIDTH / 2 && 
        y < playableArea.centerY + GOAL_WIDTH / 2) {
        return true;
    }
    
    return false;
}
function handleImprovedCollision(player, playableArea) {
    // Determine which boundary the player collided with
    
    // Top wall
    if (player.y - player.radius < 0) {
        player.y = player.radius + 0.1;
        player.vy = -player.vy * 0.5; // Bounce with reduced velocity
        
        // Add slight sideways impulse to prevent sticking
        player.vx += (Math.random() - 0.5) * 0.2;
    }
    
    // Bottom wall
    if (player.y + player.radius > playableArea.bottom) {
        player.y = playableArea.bottom - player.radius - 0.1;
        player.vy = -player.vy * 0.5;
        
        // Add slight sideways impulse to prevent sticking
        player.vx += (Math.random() - 0.5) * 0.2;
    }
    
    // Left fence
    if (player.x - player.radius < playableArea.left && 
        (player.y < playableArea.centerY - GOAL_WIDTH / 2 || 
         player.y > playableArea.centerY + GOAL_WIDTH / 2)) {
        player.x = playableArea.left + player.radius + 0.1;
        player.vx = -player.vx * 0.5;
        
        // Add slight vertical impulse to prevent sticking
        player.vy += (Math.random() - 0.5) * 0.2;
    }
    
    // Right fence
    if (player.x + player.radius > playableArea.right && 
        (player.y < playableArea.centerY - GOAL_WIDTH / 2 || 
         player.y > playableArea.centerY + GOAL_WIDTH / 2)) {
        player.x = playableArea.right - player.radius - 0.1;
        player.vx = -player.vx * 0.5;
        
        // Add slight vertical impulse to prevent sticking
        player.vy += (Math.random() - 0.5) * 0.2;
    }
    
    // Goal back walls
    if (player.x - player.radius < 0 && 
        player.y > playableArea.centerY - GOAL_WIDTH / 2 && 
        player.y < playableArea.centerY + GOAL_WIDTH / 2) {
        player.x = 0 + player.radius + 0.1;
        player.vx = -player.vx * 0.5;
    }
    
    if (player.x + player.radius > playableArea.right + FENCE_WIDTH && 
        player.y > playableArea.centerY - GOAL_WIDTH / 2 && 
        player.y < playableArea.centerY + GOAL_WIDTH / 2) {
        player.x = playableArea.right + FENCE_WIDTH - player.radius - 0.1;
        player.vx = -player.vx * 0.5;
    }
}
function handleSmoothCollision(player, boundary, axis, direction) {
    // Calculate how far past the boundary the player went
    const overlap = Math.abs(player[axis] - boundary) + 0.1;
    
    // Set position just outside boundary
    player[axis] = boundary + (direction * (player.radius + 0.1));
    
    // Apply gradual velocity reduction instead of immediate stop
    if (axis === 'x') {
        player.vx = -player.vx * 0.3; // 30% bounce rather than full stop
    } else {
        player.vy = -player.vy * 0.3;
    }
    
    // Apply slight perpendicular velocity to prevent sticking
    if (axis === 'x') {
        // Add slight random y velocity to prevent sticking
        player.vy += (Math.random() - 0.5) * 0.2;
    } else {
        // Add slight random x velocity to prevent sticking
        player.vx += (Math.random() - 0.5) * 0.2;
    }
}
// Score goal
function scoreGoal(room, team) {
    // Increment score
    room.score[team]++;
    
    // Notify all players
    io.to(room.id).emit('goal-scored', {
        team: team,
        scorer: room.lastTouched,
        score: room.score
    });
    
    // Next kickoff is for the team that conceded
    const kickoffTeam = team === 'red' ? 'blue' : 'red';
    
    // Reset ball to exact center coordinates
    room.ball = {
        x: EXACT_CENTER_X,
        y: EXACT_CENTER_Y,
        vx: 0,
        vy: 0,
        radius: BALL_RADIUS
    };
    
    positionPlayers(room);
    
    // Start kickoff
    room.kickoff = true;
    room.kickoffRestrictions = true;
    room.kickoffTeam = kickoffTeam;
    
    // Trigger kickoff countdown on client
    io.to(room.id).emit('kickoff-countdown', {
        kickoffTeam: kickoffTeam
    });
}

// Helper function to calculate distance
function getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// Generate a random room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Game loop
const FRAME_RATE = 60;
const TICK_RATE = 1000 / FRAME_RATE;

setInterval(() => {
    // Update all active game rooms
    Object.values(gameState.rooms).forEach(room => {
        if (room.gameActive) {
            updateGame(room);
            
            // Send game state to all players in room
            io.to(room.id).emit('game-update', {
                ball: room.ball,
                players: room.players,
                score: room.score
            });
        }
    });
}, TICK_RATE);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
