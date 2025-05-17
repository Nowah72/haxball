document.addEventListener('DOMContentLoaded', function() {
    // Game Constants
    const PLAYER_RADIUS = 15;
    const BALL_RADIUS = 10;
    const FIELD_PATTERN_SIZE = 30;
    const CENTER_CIRCLE_RADIUS = 60;
    const FENCE_WIDTH = 45;
    const GOAL_WIDTH = 100;
    const GOAL_DEPTH = 40;
    const GOAL_POST_WIDTH = 8;
    // Dynamic field dimensions - will be calculated based on screen size
    let fieldDimensions = {
        width: 0,
        height: 0,
        centerX: 0,
        centerY: 0,
        leftFence: 0,
        rightFence: 0
    };
    
    // DOM Elements
    const mainMenu = document.getElementById('mainMenu');
    const lobbyScreen = document.getElementById('lobbyScreen');
    const gameScreen = document.getElementById('gameScreen');
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const quitBtn = document.getElementById('quitBtn');
    const nameInput = document.getElementById('nameInput');
    const playerNameField = document.getElementById('playerNameField');
    const confirmNameBtn = document.getElementById('confirmNameBtn');
    const roomCodeInput = document.getElementById('roomCodeInput');
    const roomCodeField = document.getElementById('roomCodeField');
    const confirmRoomBtn = document.getElementById('confirmRoomBtn');
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
    const startGameBtn = document.getElementById('startGameBtn');
    const leaveGameBtn = document.getElementById('leaveGameBtn');
    const redTeamContainer = document.getElementById('redTeam');
    const blueTeamContainer = document.getElementById('blueTeam');
    const spectatorTeamContainer = document.getElementById('spectatorTeam');
    const redScore = document.getElementById('redScore');
    const blueScore = document.getElementById('blueScore');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const startingTeamSelect = document.getElementById('startingTeamSelect');
    const gameDurationSelect = document.getElementById('gameDurationSelect');
    
    // Game state
    let gameState = {
        playerName: '',
        playerId: '',
        currentRoom: null,
        isHost: false,
        teams: {
            red: [],
            blue: [],
            spectator: []
        },
        players: {},
        ball: null,
        score: {
            red: 0,
            blue: 0
        },
        keysPressed: {},
        lastInputTime: 0,
        gameActive: false,
        ping: 0,
        kickoffStartTime: null,
        kickoffCountdownComplete: false
    };
    let fieldInfo = {
        width: 0,
        height: 0,
        playableLeft: 0,
        playableRight: 0,
        playableTop: 0,
        playableBottom: 0,
        centerX: 0,
        centerY: 0,
        initialized: false
    };
    
    // Connect to server
    const socket = io();
    
    // Socket.IO event listeners
    socket.on('connect', () => {
        console.log('Connected to server');
        showNotification('Connected to server');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        showNotification('Disconnected from server', 'error');
    });
    
    socket.on('joined-game', (playerId) => {
        gameState.playerId = playerId;
    });
    
    socket.on('room-created', (roomId) => {
        console.log('Room created:', roomId);
        gameState.currentRoom = roomId;
        roomCodeDisplay.textContent = roomId;
    });
    socket.on('kickoff-countdown-complete', () => {
        // Logic to start the actual gameplay after countdown
        io.to(roomId).emit('kickoff-complete');
    });
    
    socket.on('kickoff-complete', () => {
        gameState.kickoff = false;
        gameState.kickoffStartTime = null;
        gameState.kickoffCountdownComplete = false;
        gameState.kickoffRestrictions = true; // Restrictions remain until ball touched
        addChatMessage('System', 'Ball ready to play! Only ' + gameState.kickoffTeam.toUpperCase() + ' team can touch the ball.');
    });
    socket.on('kickoff-restrictions-end', () => {
        gameState.kickoffRestrictions = false;
        addChatMessage('System', 'Ball in play!');
    });

    socket.on('room-joined', (data) => {
        console.log('Joined room:', data);
        gameState.currentRoom = data.roomId;
        gameState.players = data.players;
        gameState.teams = data.teams;
        gameState.isHost = data.isHost;
        
        // Update UI
        roomCodeDisplay.textContent = data.roomId;
        startGameBtn.style.display = data.isHost ? 'block' : 'none';
        renderTeams();
        
        // Switch to lobby screen
        mainMenu.style.display = 'none';
        lobbyScreen.style.display = 'flex';
    });
    
    socket.on('player-joined', (data) => {
        console.log('Player joined:', data);
        gameState.players = data.players;
        gameState.teams = data.teams;
        renderTeams();
        showNotification(`${data.playerName} joined the game`);
    });
    
    socket.on('player-left', (playerId) => {
        if (gameState.players[playerId]) {
            const playerName = gameState.players[playerId].name;
            delete gameState.players[playerId];
            
            // Remove from teams
            ['red', 'blue', 'spectator'].forEach(team => {
                gameState.teams[team] = gameState.teams[team].filter(p => p.id !== playerId);
            });
            
            renderTeams();
            showNotification(`${playerName} left the game`);
        }
    });
    
    socket.on('teams-updated', (teams) => {
        gameState.teams = teams;
        renderTeams();
    });
    
    socket.on('settings-updated', (settings) => {
        // Update settings UI
        startingTeamSelect.value = settings.startingTeam;
        gameDurationSelect.value = settings.gameDuration;
    });
    
    socket.on('new-host', (hostId) => {
        gameState.isHost = (hostId === gameState.playerId);
        startGameBtn.style.display = gameState.isHost ? 'block' : 'none';
        
        if (gameState.isHost) {
            showNotification('You are now the host');
        }
    });
    
    socket.on('game-started', (data) => {
        console.log('Game started:', data);
        gameState.ball = data.ball;
        gameState.players = data.players;
        gameState.score = data.score;
        gameState.gameActive = true;
        gameState.kickoff = true;
        gameState.kickoffRestrictions = true; // Add this line
        gameState.kickoffTeam = data.kickoffTeam; // Make sure this is set
        gameState.kickoffStartTime = null;
        
        // Display scores
        redScore.textContent = data.score.red;
        blueScore.textContent = data.score.blue;
        
        // Switch to game screen
        lobbyScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        
        // Make sure canvas is properly sized
        resizeCanvas();
        
        // Send canvas size to server
        socket.emit('canvas-size', {
            width: canvas.width,
            height: canvas.height,
            fenceWidth: FENCE_WIDTH,
            goalWidth: GOAL_WIDTH
        });
        
        // Start game loop
        gameLoop();
        
        // Add message
        addChatMessage('System', 'Game started! Use WASD or arrow keys to move. SPACE to shoot.');
        
        // Log data for debugging
        console.log("Game field size:", canvas.width, "x", canvas.height);
        console.log("Ball position:", data.ball.x, data.ball.y);
    });
    
    socket.on('game-update', (data) => {
        // Calculate ping only if we've sent input
        if (gameState.lastInputTime > 0) {
            const now = Date.now();
            gameState.ping = now - gameState.lastInputTime;
            // Reset lastInputTime to avoid increasing ping when not sending inputs
            gameState.lastInputTime = 0;
        }
        
        // Update all players with server positions
        Object.keys(data.players).forEach(playerId => {
            if (gameState.players[playerId]) {
                // Store server position
                gameState.players[playerId].serverX = data.players[playerId].x;
                gameState.players[playerId].serverY = data.players[playerId].y;
                
                // If this is not the current player, update directly
                if (playerId !== gameState.playerId) {
                    gameState.players[playerId].x = data.players[playerId].x;
                    gameState.players[playerId].y = data.players[playerId].y;
                }
                
                // Copy other properties
                gameState.players[playerId].vx = data.players[playerId].vx;
                gameState.players[playerId].vy = data.players[playerId].vy;
            }
        });
        
        // Always update ball directly
        gameState.ball = data.ball;
        
        // Update score display
        gameState.score = data.score;
        redScore.textContent = data.score.red;
        blueScore.textContent = data.score.blue;
    });
    
    socket.on('goal-scored', (data) => {
        const { team, scorer, score } = data;
        const teamName = team.toUpperCase();
        
        // Update scores
        gameState.score = score;
        redScore.textContent = score.red;
        blueScore.textContent = score.blue;
        
        // Set kickoff back to true and update kickoff team
        gameState.kickoff = true;
        gameState.kickoffRestrictions = true;
        gameState.kickoffTeam = team === 'red' ? 'blue' : 'red';
        gameState.kickoffStartTime = null;
        
        // Add message
        if (scorer && gameState.players[scorer]) {
            const scorerName = gameState.players[scorer].name;
            addChatMessage('System', `GOAL! ${scorerName} scored for ${teamName} team! (${score.red} - ${score.blue})`);
        } else {
            addChatMessage('System', `GOAL for ${teamName} team! (${score.red} - ${score.blue})`);
        }
    });
    
    
    socket.on('game-ended', (data) => {
        gameState.gameActive = false;
        
        // Display result
        let resultMessage;
        if (data.score.red > data.score.blue) {
            resultMessage = `RED team wins ${data.score.red} - ${data.score.blue}!`;
        } else if (data.score.blue > data.score.red) {
            resultMessage = `BLUE team wins ${data.score.blue} - ${data.score.red}!`;
        } else {
            resultMessage = `Game ended in a ${data.score.red} - ${data.score.blue} draw!`;
        }
        
        addChatMessage('System', 'GAME OVER! ' + resultMessage);
        
        // Return to lobby
        setTimeout(() => {
            gameScreen.style.display = 'none';
            lobbyScreen.style.display = 'flex';
        }, 3000);
    });
    
    socket.on('chat-message', (data) => {
        addChatMessage(data.sender, data.message);
    });
    
    socket.on('error', (message) => {
        showNotification(message, 'error');
    });
    
    // Event listeners for UI elements
    createRoomBtn.addEventListener('click', () => {
        nameInput.style.display = 'block';
        gameState.action = 'create';
    });
    
    joinRoomBtn.addEventListener('click', () => {
        nameInput.style.display = 'block';
        gameState.action = 'join';
    });
    
    confirmNameBtn.addEventListener('click', () => {
        const name = playerNameField.value.trim();
        if (name) {
            gameState.playerName = name;
            
            // Join game with name
            socket.emit('join-game', name);
            
            if (gameState.action === 'create') {
                // Create room
                socket.emit('create-room');
            } else if (gameState.action === 'join') {
                // Show room code input
                nameInput.style.display = 'none';
                roomCodeInput.style.display = 'block';
            }
        } else {
            showNotification('Please enter a valid name', 'error');
        }
    });
    
    playerNameField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmNameBtn.click();
        }
    });
    
    confirmRoomBtn.addEventListener('click', () => {
        const roomCode = roomCodeField.value.trim().toUpperCase();
        if (roomCode) {
            // Join room
            socket.emit('join-room', roomCode);
        } else {
            showNotification('Please enter a valid room code', 'error');
        }
    });
    
    roomCodeField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            confirmRoomBtn.click();
        }
    });
    
    copyRoomCodeBtn.addEventListener('click', () => {
        const roomCode = roomCodeDisplay.textContent;
        navigator.clipboard.writeText(roomCode)
            .then(() => {
                showNotification('Room code copied to clipboard');
            })
            .catch(() => {
                showNotification('Failed to copy room code', 'error');
            });
    });
    
    settingsBtn.addEventListener('click', () => {
        showNotification('Settings functionality will be added in the future');
    });
    
    quitBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to quit?')) {
            window.close();
        }
    });
    
    startGameBtn.addEventListener('click', () => {
        if (!gameState.isHost) {
            showNotification('Only the host can start the game', 'error');
            return;
        }
        
        // Get settings
        const settings = {
            startingTeam: startingTeamSelect.value,
            gameDuration: parseInt(gameDurationSelect.value)
        };
        
        // Update settings
        socket.emit('update-settings', settings);
        
        // Start game
        socket.emit('start-game');
    });
    
    leaveGameBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave the game?')) {
            socket.emit('leave-game');
            
            // Return to main menu
            gameScreen.style.display = 'none';
            lobbyScreen.style.display = 'none';
            mainMenu.style.display = 'flex';
            
            // Reset game state
            resetGameState();
        }
    });
    
    // Team selection
    function setupDragAndDrop() {
        let draggedPlayer = null;
        
        // Setup drag and drop for player elements
        document.addEventListener('mousedown', (e) => {
            if (e.target.matches('.player')) {
                const playerId = e.target.getAttribute('data-id');
                
                // Only allow dragging if host or if it's the current player
                if (gameState.isHost || playerId === gameState.playerId) {
                    draggedPlayer = e.target;
                }
            }
        });
        
        document.addEventListener('dragstart', (e) => {
            if (e.target.matches('.player')) {
                e.dataTransfer.setData('text/plain', e.target.getAttribute('data-id'));
            }
        });
        
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (draggedPlayer) {
                const teamContainer = e.target.closest('[data-team]');
                if (teamContainer) {
                    const playerId = draggedPlayer.getAttribute('data-id');
                    const newTeam = teamContainer.getAttribute('data-team');
                    
                    // Move player to team
                    if (gameState.isHost) {
                        // Host can move any player
                        socket.emit('move-player', { playerId, team: newTeam });
                    } else if (playerId === gameState.playerId) {
                        // Player can only move themselves
                        socket.emit('change-team', newTeam);
                    }
                }
                
                draggedPlayer = null;
            }
        });
    }
    
    // Make player elements draggable
    function makePlayerDraggable(playerElement) {
        playerElement.setAttribute('draggable', 'true');
    }
    
    // Create player element
    function createPlayerElement(player) {
        const element = document.createElement('div');
        element.className = 'player';
        element.setAttribute('data-id', player.id);
        
        // Add label if it's the current player
        let nameText = player.name;
        if (player.id === gameState.playerId) {
            nameText += ' (You)';
        }
        
        element.textContent = nameText;
        
        // Make draggable
        makePlayerDraggable(element);
        
        return element;
    }
    
    // Render teams
    function renderTeams() {
        // Clear team containers
        redTeamContainer.innerHTML = '';
        blueTeamContainer.innerHTML = '';
        spectatorTeamContainer.innerHTML = '';
        
        // Render red team
        gameState.teams.red.forEach(player => {
            const element = createPlayerElement(player);
            redTeamContainer.appendChild(element);
        });
        
        // Render blue team
        gameState.teams.blue.forEach(player => {
            const element = createPlayerElement(player);
            blueTeamContainer.appendChild(element);
        });
        
        // Render spectators
        gameState.teams.spectator.forEach(player => {
            const element = createPlayerElement(player);
            spectatorTeamContainer.appendChild(element);
        });
    }
    
    // Chat functionality
    chatSendBtn.addEventListener('click', sendChatMessage);
    
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    
    function sendChatMessage() {
        const message = chatInput.value.trim();
        if (message) {
            socket.emit('chat-message', {
                message: message
            });
            chatInput.value = '';
        }
    }
    
    function addChatMessage(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${sender}: ${message}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        gameState.keysPressed[e.code] = true;
    });
    
    window.addEventListener('keyup', (e) => {
        gameState.keysPressed[e.code] = false;
    });
    
    // Window resize
    window.addEventListener('resize', resizeCanvas);
    
    function resizeCanvas() {
        // Get available space
        canvas.width = gameScreen.clientWidth;
        canvas.height = gameScreen.clientHeight - 80; // Account for chat
        
        // Calculate field dimensions based on available space
        fieldDimensions = {
            width: canvas.width,
            height: canvas.height,
            centerX: canvas.width / 2,
            centerY: canvas.height / 2,
            leftFence: FENCE_WIDTH,
            rightFence: canvas.width - FENCE_WIDTH
        };
        
        console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
        
        // Send size to server with calculated values
        if (gameState.currentRoom) {
            socket.emit('canvas-size', {
                width: fieldDimensions.width,
                height: fieldDimensions.height,
                centerX: fieldDimensions.centerX,
                centerY: fieldDimensions.centerY,
                fenceWidth: FENCE_WIDTH,
                goalWidth: GOAL_WIDTH
            });
        }
    }
    // Game loop
    function gameLoop() {
        if (!gameState.gameActive) return;
        
        // Send player input to server
        sendPlayerInput();
        
        // Perform client-side prediction if needed
        performClientPrediction();
        
        // Render game
        renderGame();
        
        // Continue loop
        requestAnimationFrame(gameLoop);
    }
    function drawDebugInfo() {
        // Draw player positions received from server
        Object.values(gameState.players).forEach(player => {
            if (player.team === 'spectator') return;
            
            // Draw small dot at server position
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(player.serverX || player.x, player.serverY || player.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // Draw ball server position
        if (gameState.ball) {
            ctx.fillStyle = 'yellow';
            ctx.beginPath();
            ctx.arc(gameState.ball.x, gameState.ball.y, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw line to show where the ball should be
            ctx.strokeStyle = 'yellow';
            ctx.beginPath();
            ctx.moveTo(gameState.ball.x, gameState.ball.y);
            ctx.lineTo(fieldDimensions.centerX, fieldDimensions.centerY);
            ctx.stroke();
        }
    }
    
    
    // Send player input to server
    function sendPlayerInput() {
        // Only send if game is active
        if (!gameState.gameActive) return;
        
        // Get current player from players dictionary
        const currentPlayer = gameState.players[gameState.playerId];
        if (!currentPlayer || currentPlayer.team === 'spectator') return;
        
        // Build input object
        const input = {
            left: gameState.keysPressed['ArrowLeft'] || gameState.keysPressed['KeyA'] || false,
            right: gameState.keysPressed['ArrowRight'] || gameState.keysPressed['KeyD'] || false,
            up: gameState.keysPressed['ArrowUp'] || gameState.keysPressed['KeyW'] || false,
            down: gameState.keysPressed['ArrowDown'] || gameState.keysPressed['KeyS'] || false,
            shoot: gameState.keysPressed['Space'] || false
        };
        
        // Only send if input has changed
        const inputChanged = 
            input.left !== gameState.lastInput?.left ||
            input.right !== gameState.lastInput?.right ||
            input.up !== gameState.lastInput?.up ||
            input.down !== gameState.lastInput?.down ||
            input.shoot !== gameState.lastInput?.shoot;
        
        if (inputChanged) {
            socket.emit('player-input', input);
            gameState.lastInput = { ...input };
            gameState.lastInputTime = Date.now();
        }
    }
    function performClientPrediction() {
        // Only predict for the current player
        const currentPlayer = gameState.players[gameState.playerId];
        if (!currentPlayer || currentPlayer.team === 'spectator') return;
        
        // Store the server position
        if (!currentPlayer.serverX) {
            currentPlayer.serverX = currentPlayer.x;
            currentPlayer.serverY = currentPlayer.y;
        }
        
        // Calculate client-side predicted position
        // This will make movement feel more responsive
        const input = gameState.lastInput || {};
        
        // Calculate direction from current input
        let dx = 0, dy = 0;
        if (input.left) dx -= 1;
        if (input.right) dx += 1;
        if (input.up) dy -= 1;
        if (input.down) dy += 1;
        
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }
        
        // Apply very small prediction (just enough to feel responsive)
        // but not so much that server corrections are jarring
        const PREDICTION_AMOUNT = 2;
        if (dx !== 0 || dy !== 0) {
            currentPlayer.x += dx * PREDICTION_AMOUNT;
            currentPlayer.y += dy * PREDICTION_AMOUNT;
        }
        
        // Gradually interpolate back to server position
        const LERP_FACTOR = 0.2;
        currentPlayer.x = currentPlayer.x * (1 - LERP_FACTOR) + currentPlayer.serverX * LERP_FACTOR;
        currentPlayer.y = currentPlayer.y * (1 - LERP_FACTOR) + currentPlayer.serverY * LERP_FACTOR;
    }
    
    // Render the game
    // Render the game
function renderGame() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw field
    drawField();
    
    // Draw players
    drawPlayers();
    
    // Draw ball
    drawBall();
    
    // Draw ping
    drawPing();
    
    // Draw countdown animation if kickoff is active
    if (gameState.kickoff) {
        drawKickoffCountdown();
    }
}
    function drawKickoffRestrictions() {
        if (!gameState.kickoffTeam) return;
        
        // Draw semi-transparent center circle
        const kickoffColor = gameState.kickoffTeam === 'red' ? 
            'rgba(231, 76, 60, 0.2)' : 
            'rgba(52, 152, 219, 0.2)';
        
        // Highlight center circle
        ctx.fillStyle = kickoffColor;
        ctx.beginPath();
        ctx.arc(fieldDimensions.centerX, fieldDimensions.centerY, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight the midline
        ctx.strokeStyle = kickoffColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(fieldDimensions.centerX, 0);
        ctx.lineTo(fieldDimensions.centerX, fieldDimensions.height);
        ctx.stroke();
    }
    
    // Draw the field
    function drawField() {
        // Field background
        ctx.fillStyle = '#1a472a'; // Dark green
        ctx.fillRect(0, 0, fieldDimensions.width, fieldDimensions.height);
        
        // Draw checkerboard pattern only inside fence area
        ctx.fillStyle = '#235c37'; // Slightly lighter green
        const patternSize = FIELD_PATTERN_SIZE;
        
        // Only draw checkers within the playable area
        for (let x = fieldDimensions.leftFence; x < fieldDimensions.rightFence; x += patternSize) {
            for (let y = 0; y < fieldDimensions.height; y += patternSize) {
                // Only fill every other square for checkered pattern
                if ((Math.floor(x / patternSize) + Math.floor(y / patternSize)) % 2 === 0) {
                    const drawWidth = Math.min(patternSize, fieldDimensions.rightFence - x);
                    ctx.fillRect(x, y, drawWidth, patternSize);
                }
            }
        }
        
        // Center line
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fieldDimensions.centerX, 0);
        ctx.lineTo(fieldDimensions.centerX, fieldDimensions.height);
        ctx.stroke();
        
        // Center circle
        ctx.beginPath();
        ctx.arc(fieldDimensions.centerX, fieldDimensions.centerY, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        
        // Center spot (enlarged for visibility)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(fieldDimensions.centerX, fieldDimensions.centerY, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw goals and fence
        drawGoals();
        drawFence();
    }
    
    
    // Draw goals
    // Draw goals
function drawGoals() {
    // Left goal (red)
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(fieldDimensions.leftFence - 5, fieldDimensions.centerY, GOAL_WIDTH / 2, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();
    
    // Red goal post dots
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(fieldDimensions.leftFence, fieldDimensions.centerY - GOAL_WIDTH / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fieldDimensions.leftFence, fieldDimensions.centerY + GOAL_WIDTH / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Right goal (blue)
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(fieldDimensions.rightFence + 5, fieldDimensions.centerY, GOAL_WIDTH / 2, Math.PI / 2, -Math.PI / 2, true);
    ctx.stroke();
    
    // Blue goal post dots
    ctx.fillStyle = 'blue';
    ctx.beginPath();
    ctx.arc(fieldDimensions.rightFence, fieldDimensions.centerY - GOAL_WIDTH / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fieldDimensions.rightFence, fieldDimensions.centerY + GOAL_WIDTH / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Left goal area
    ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
    ctx.fillRect(0, fieldDimensions.centerY - GOAL_WIDTH / 2, fieldDimensions.leftFence, GOAL_WIDTH);
    
    // Right goal area
    ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
    ctx.fillRect(fieldDimensions.rightFence, fieldDimensions.centerY - GOAL_WIDTH / 2, FENCE_WIDTH, GOAL_WIDTH);
    
    // Draw goal nets
    drawGoalNets();
}
// Draw goal nets
// Draw goal nets
// Draw goal nets
// Draw goal nets
function drawGoalNets() {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    
    // Left goal net - vertical lines
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(fieldDimensions.leftFence - i * (GOAL_DEPTH / 4), fieldDimensions.centerY - GOAL_WIDTH / 2);
        ctx.lineTo(fieldDimensions.leftFence - i * (GOAL_DEPTH / 4), fieldDimensions.centerY + GOAL_WIDTH / 2);
        ctx.stroke();
    }
    
    // Left goal net - horizontal lines
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(fieldDimensions.leftFence, fieldDimensions.centerY - GOAL_WIDTH / 2 + i * (GOAL_WIDTH / 4));
        ctx.lineTo(fieldDimensions.leftFence - GOAL_DEPTH, fieldDimensions.centerY - GOAL_WIDTH / 2 + i * (GOAL_WIDTH / 4));
        ctx.stroke();
    }
    
    // Right goal net - vertical lines
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(fieldDimensions.rightFence + i * (GOAL_DEPTH / 4), fieldDimensions.centerY - GOAL_WIDTH / 2);
        ctx.lineTo(fieldDimensions.rightFence + i * (GOAL_DEPTH / 4), fieldDimensions.centerY + GOAL_WIDTH / 2);
        ctx.stroke();
    }
    
    // Right goal net - horizontal lines
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(fieldDimensions.rightFence, fieldDimensions.centerY - GOAL_WIDTH / 2 + i * (GOAL_WIDTH / 4));
        ctx.lineTo(fieldDimensions.rightFence + GOAL_DEPTH, fieldDimensions.centerY - GOAL_WIDTH / 2 + i * (GOAL_WIDTH / 4));
        ctx.stroke();
    }
}

// Draw fence
function drawFence() {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    // Left side (connecting with goal posts)
    ctx.moveTo(fieldDimensions.leftFence, 0);
    ctx.lineTo(fieldDimensions.leftFence, fieldDimensions.centerY - GOAL_WIDTH / 2);
    
    // Resume after left goal
    ctx.moveTo(fieldDimensions.leftFence, fieldDimensions.centerY + GOAL_WIDTH / 2);
    ctx.lineTo(fieldDimensions.leftFence, fieldDimensions.height);
    
    // Bottom
    ctx.lineTo(fieldDimensions.rightFence, fieldDimensions.height);
    
    // Right side (connecting with goal posts)
    ctx.lineTo(fieldDimensions.rightFence, fieldDimensions.centerY + GOAL_WIDTH / 2);
    
    // Resume after right goal
    ctx.moveTo(fieldDimensions.rightFence, fieldDimensions.centerY - GOAL_WIDTH / 2);
    ctx.lineTo(fieldDimensions.rightFence, 0);
    
    // Top
    ctx.lineTo(fieldDimensions.leftFence, 0);
    
    ctx.stroke();
}
// Draw kickoff countdown
function drawKickoffCountdown() {
    if (!gameState.kickoff || !gameState.kickoffStartTime) return;
    
    // Initialize the kickoff start time if not set
    if (gameState.kickoffStartTime === null) {
        gameState.kickoffStartTime = Date.now();
    }
    
    // Calculate elapsed time since kickoff started
    const elapsedTime = Date.now() - gameState.kickoffStartTime;
    const totalCountdownTime = 4000; // 4 seconds total (3, 2, 1, GO!)
    
    // Skip drawing if countdown is complete
    if (elapsedTime >= totalCountdownTime) {
        // Tell server the countdown is complete if we're the host
        if (gameState.isHost && gameState.kickoffCountdownComplete !== true) {
            socket.emit('kickoff-countdown-complete');
            gameState.kickoffCountdownComplete = true;
        }
        return;
    }
    
    // Determine which number to show (3, 2, 1, GO!)
    let countdownText = '';
    let textColor = 'white';
    let fontSize = '72px';
    
    if (elapsedTime < 1000) {
        countdownText = '3';
    } else if (elapsedTime < 2000) {
        countdownText = '2';
    } else if (elapsedTime < 3000) {
        countdownText = '1';
    } else {
        countdownText = 'GO!';
        textColor = gameState.kickoffTeam === 'red' ? '#e74c3c' : '#3498db';
        fontSize = '84px';
    }
    
    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, fieldDimensions.width, fieldDimensions.height);
    
    // Draw countdown text
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize} Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw text with shadow for better visibility
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    
    // Animate the current number with a scale effect
    const timeInCurrentPhase = elapsedTime % 1000;
    const scale = 1 + 0.5 * Math.sin(Math.PI * timeInCurrentPhase / 1000);
    
    // Save context state before transformations
    ctx.save();
    
    // Apply scale transformation centered on the text
    ctx.translate(fieldDimensions.centerX, fieldDimensions.centerY);
    ctx.scale(scale, scale);
    ctx.fillText(countdownText, 0, 0);
    
    // Restore context state
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Add kickoff team indication
    ctx.font = 'bold 20px Arial';
    const teamName = gameState.kickoffTeam === 'red' ? 'RED' : 'BLUE';
    ctx.fillStyle = gameState.kickoffTeam === 'red' ? '#e74c3c' : '#3498db';
    ctx.fillText(`${teamName} team kicks off`, fieldDimensions.centerX, fieldDimensions.centerY + 70);
}
// Draw players
function drawPlayers() {
    if (!gameState.players) return;
    
    // Draw all players
    Object.values(gameState.players).forEach(player => {
        if (player.team === 'spectator') return;
        
        // Draw motion trail if player is moving fast enough
        drawPlayerMotionTrail(player);
        
        // Set color based on team
        if (player.team === 'red') {
            ctx.fillStyle = '#e74c3c';
        } else {
            ctx.fillStyle = '#3498db';
        }
        
        // Draw player circle
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius || PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // Player outline
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius || PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        
        // Player name
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // Show special indicator for current player
        if (player.id === gameState.playerId) {
            // Yellow ring for shooting indicator with pulsing effect
            if (gameState.keysPressed['Space']) {
                const pulseSize = 3 + Math.sin(Date.now() / 100) * 1.5;
                ctx.strokeStyle = 'yellow';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(player.x, player.y, (player.radius || PLAYER_RADIUS) + pulseSize, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Default current player indicator
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.arc(player.x, player.y, (player.radius || PLAYER_RADIUS) + 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            // Only draw "You" text for current player
            ctx.fillText('You', player.x, player.y - (player.radius || PLAYER_RADIUS) - 5);
        } else {
            // Draw name for other players
            ctx.fillText(player.name, player.x, player.y - (player.radius || PLAYER_RADIUS) - 5);
        }
    });
}
// Draw player motion trail
function drawPlayerMotionTrail(player) {
    // Check if player has velocity properties
    if (!player.vx || !player.vy) return;
    
    // Only draw motion trails for players moving at a decent speed
    if (Math.abs(player.vx) > 0.8 || Math.abs(player.vy) > 0.8) {
        const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
        const maxTrailLength = 5; // Maximum number of trail segments
        const trailLength = Math.min(maxTrailLength, Math.floor(speed * 1.5));
        
        // Set trail colors based on team with higher opacity
        if (player.team === 'red') {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.6)'; // More visible red
        } else {
            ctx.fillStyle = 'rgba(52, 152, 219, 0.6)'; // More visible blue
        }
        
        // Draw trail segments
        for (let i = 1; i <= trailLength; i++) {
            const trailX = player.x - (player.vx * i * 0.4); // Increased spacing
            const trailY = player.y - (player.vy * i * 0.4);
            const trailRadius = (player.radius || PLAYER_RADIUS) * (1 - i / (trailLength + 2)) * 0.8; // Slightly smaller
            
            ctx.beginPath();
            ctx.arc(trailX, trailY, trailRadius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
// Draw ball
function drawBall() {
    if (!gameState.ball) return;
    
    // Ball circle
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius || BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    
    // Ball outline
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius || BALL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(
        gameState.ball.x, 
        gameState.ball.y + (gameState.ball.radius || BALL_RADIUS) + 2, 
        (gameState.ball.radius || BALL_RADIUS) * 0.8, 
        (gameState.ball.radius || BALL_RADIUS) * 0.3, 
        0, 0, Math.PI * 2
    );
    ctx.fill();
}
// Draw ping display
function drawPing() {
    ctx.fillStyle = gameState.ping < 100 ? '#2ecc71' : gameState.ping < 200 ? '#f39c12' : '#e74c3c';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Ping: ${gameState.ping}ms`, fieldDimensions.width - 10, 20);
}

 // Reset game state
    function resetGameState() {
        gameState = {
            playerName: gameState.playerName,
            playerId: gameState.playerId,
            currentRoom: null,
            isHost: false,
            teams: {
                red: [],
                blue: [],
                spectator: []
            },
            players: {},
            ball: null,
            score: {
                red: 0,
                blue: 0
            },
            keysPressed: {},
            lastInputTime: 0,
            gameActive: false,
            ping: 0
        };
    }

 // Show notification
function showNotification(message, type = 'success') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    if (type === 'error') {
        notification.style.backgroundColor = 'rgba(231, 76, 60, 0.9)';
    }
    notification.textContent = message;
    
    // Add to body
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        
        // Remove notification after animation
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Initialize
function init() {
    // Set up drag and drop for team selectiongol
    setupDragAndDrop();
    
    // Resize canvas
    resizeCanvas();
}

// Start initialization when DOM is loaded
init();
});