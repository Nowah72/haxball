document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded");
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
    const stadiumOptions = [
        {
            id: 'small',
            name: 'Small Stadium',
            description: 'Perfect for 1v1 or 2v2 matches',
            width: 700,  // Smaller than the current stadium
            height: 450,
            image: 'images/stadium-small.svg', 
            recommendedPlayers: '1v1 or 2v2'
        },
        {
            id: 'medium',
            name: 'Medium Stadium',
            description: 'Ideal for 3v3 or 4v4 matches',
            width: 1000, // Your current stadium size
            height: 600,
            image: 'images/stadium-medium.svg',
            recommendedPlayers: '3v3 or 4v4'
        },
        {
            id: 'large',
            name: 'Large Stadium',
            description: 'Best for 5v5 matches and up',
            width: 1300, // Larger than the current stadium
            height: 800,
            image: 'images/stadium-large.svg',
            recommendedPlayers: '5v5 and up'
        }
    ];
    
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
        selectedStadium: 'medium',
    kickoffCountdownComplete: false,
    kickoffRestrictions: false,
    frictionEnabled: true, // Can be toggled in settings if needed
    frictionFactor: 0.90,  // Higher = more slippery (0.94-0.98 is a good range)
    lastActiveInputTime: 0,
    particles: [],          // Array to store active particles
    goalParticles: [],      // Array to store goal celebration particles
    particlesEnabled: true, // Flag to enable/disable particles (for performance)
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
    createRoomBtn.onclick = function() {
        console.log("Create Room button clicked");
        nameInput.style.display = 'block';
        stadiumSelectorContainer.style.display = 'block';
        gameState.action = 'create';
    };
    
    joinRoomBtn.onclick = function() {
        console.log("Join Room button clicked");
        nameInput.style.display = 'block';
        gameState.action = 'join';
    };
    
    confirmNameBtn.onclick = function() {
        console.log("Confirm Name button clicked");
        const name = playerNameField.value.trim();
        if (name) {
            gameState.playerName = name;
            
            // Join game with name
            socket.emit('join-game', name);
            
            if (gameState.action === 'create') {
                // Create room with selected stadium
                socket.emit('create-room', {
                    stadiumId: gameState.selectedStadium
                });
            } else if (gameState.action === 'join') {
                // Show room code input
                nameInput.style.display = 'none';
                stadiumSelectorContainer.style.display = 'none';
                roomCodeInput.style.display = 'block';
            }
        } else {
            showNotification('Please enter a valid name', 'error');
        }
    };
    
    confirmRoomBtn.onclick = function() {
        console.log("Confirm Room button clicked");
        const roomCode = roomCodeField.value.trim().toUpperCase();
        if (roomCode) {
            // Join room
            socket.emit('join-room', roomCode);
        } else {
            showNotification('Please enter a valid room code', 'error');
        }
    };
    
    copyRoomCodeBtn.onclick = function() {
        const roomCode = roomCodeDisplay.textContent;
        navigator.clipboard.writeText(roomCode)
            .then(() => {
                showNotification('Room code copied to clipboard');
            })
            .catch(() => {
                showNotification('Failed to copy room code', 'error');
            });
    };
    
    settingsBtn.onclick = function() {
        showNotification('Settings functionality will be added in the future');
    };
    
    quitBtn.onclick = function() {
        if (confirm('Are you sure you want to quit?')) {
            window.close();
        }
    };

    initializeStadiumSelector();
    
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
    socket.on('kickoff-countdown', (data) => {
        console.log('Kickoff countdown started');
        gameState.kickoff = true;
        gameState.kickoffStartTime = Date.now();
        gameState.kickoffTeam = data.kickoffTeam;
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
    gameState.stadiumId = data.stadiumId || 'medium';
    
    // Update UI
    roomCodeDisplay.textContent = data.roomId;
    startGameBtn.style.display = data.isHost ? 'block' : 'none';
    
    // Display stadium info if available
    if (data.stadiumName) {
        const existingInfo = document.querySelector('.stadium-info-display');
        if (existingInfo) existingInfo.remove();
        
        const stadiumInfo = document.createElement('div');
        stadiumInfo.className = 'stadium-info-display';
        stadiumInfo.textContent = `Stadium: ${data.stadiumName}`;
        stadiumInfo.style.marginLeft = '15px';
        stadiumInfo.style.color = '#3498db';
        document.querySelector('.lobby-header').appendChild(stadiumInfo);
    }
    
    renderTeams();
    
    // Switch to lobby screen
    mainMenu.style.display = 'none';
    lobbyScreen.style.display = 'flex';
    });
    
    socket.on('player-joined', (data) => {
        console.log('Player joined:', data);
        gameState.players = data.players;
        gameState.teams = data.teams;
        
        // Clear team containers first to prevent duplicates
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
        gameState.kickoffRestrictions = true;
        gameState.kickoffTeam = data.kickoffTeam;
        gameState.kickoffStartTime = null;
        
        // Log kickoff team for debugging
        console.log(`Starting kickoff: ${data.kickoffTeam} team`);
        
        // CRITICAL: Store the stadium configuration
        gameState.stadiumConfig = data.stadiumConfig;
        
        // Set field dimensions based on the stadium config
        if (data.stadiumConfig) {
            console.log("Using stadium configuration:", data.stadiumConfig);
            fieldDimensions = {
                width: data.stadiumConfig.width,
                height: data.stadiumConfig.height,
                centerX: data.stadiumConfig.centerX,
                centerY: data.stadiumConfig.centerY,
                leftFence: data.stadiumConfig.fenceWidth,
                rightFence: data.stadiumConfig.width - data.stadiumConfig.fenceWidth
            };
        }
        
        // Display scores
        redScore.textContent = data.score.red;
        blueScore.textContent = data.score.blue;
        
        // Switch to game screen
        lobbyScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        
        // Resize canvas to match stadium dimensions
        resizeCanvasToStadium();
        
        // Send canvas size to server
        socket.emit('canvas-size', {
            width: canvas.width,
            height: canvas.height
        });
        
        // Start game loop
        gameLoop();
        
        // Add message
        addChatMessage('System', `Game started! ${data.kickoffTeam.toUpperCase()} team kicks off. Use WASD or arrow keys to move. SPACE to shoot.`);
        
        // Log data for debugging
        console.log("Game field size:", fieldDimensions.width, "x", fieldDimensions.height);
        console.log("Field center:", fieldDimensions.centerX, fieldDimensions.centerY);
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
        
        // Make sure ball is centered exactly
        if (gameState.ball && gameState.stadiumConfig) {
            gameState.ball.x = gameState.stadiumConfig.centerX;
            gameState.ball.y = gameState.stadiumConfig.centerY;
            gameState.ball.vx = 0;
            gameState.ball.vy = 0;
            
            console.log(`Ball reset to ${gameState.ball.x}, ${gameState.ball.y} after goal`);
        }
        
        // Add message
        if (scorer && gameState.players[scorer]) {
            const scorerName = gameState.players[scorer].name;
            addChatMessage('System', `GOAL! ${scorerName} scored for ${teamName} team! (${score.red} - ${score.blue})`);
        } else {
            addChatMessage('System', `GOAL for ${teamName} team! (${score.red} - ${score.blue})`);
        }
        
        // Trigger goal celebration effect
        if (gameState.particlesEnabled) {
            let goalX, goalY;
            
            // Determine which goal was scored in
            if (team === 'red') {
                // Red team scored, so the goal was in the right side (blue's goal)
                goalX = fieldDimensions.rightFence;
            } else {
                // Blue team scored, so the goal was in the left side (red's goal)
                goalX = fieldDimensions.leftFence;
            }
            goalY = fieldDimensions.centerY;
            
            // Store celebration info
            gameState.goalCelebrationActive = true;
            gameState.goalCelebrationStartTime = Date.now();
            gameState.goalScoredTeam = team;
            gameState.goalX = goalX;
            gameState.goalY = goalY;
            
            // Initial burst of particles
            for (let i = 0; i < 30; i++) {
                spawnGoalParticle(team, goalX, goalY);
            }
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
    document.getElementById('stadiumSelectorContainer').style.display = 'block';
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
                // Create room with selected stadium
                socket.emit('create-room', {
                    stadiumId: gameState.selectedStadium
                });
            } else if (gameState.action === 'join') {
                // Show room code input
                nameInput.style.display = 'none';
                document.getElementById('stadiumSelectorContainer').style.display = 'none';
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
        
        // Track players we've already rendered to prevent duplicates
        const renderedPlayers = new Set();
        
        // Render red team
        gameState.teams.red.forEach(player => {
            if (renderedPlayers.has(player.id)) return; // Skip if already rendered
            renderedPlayers.add(player.id);
            
            const element = createPlayerElement(player);
            redTeamContainer.appendChild(element);
        });
        
        // Render blue team
        gameState.teams.blue.forEach(player => {
            if (renderedPlayers.has(player.id)) return; // Skip if already rendered
            renderedPlayers.add(player.id);
            
            const element = createPlayerElement(player);
            blueTeamContainer.appendChild(element);
        });
        
        // Render spectators
        gameState.teams.spectator.forEach(player => {
            if (renderedPlayers.has(player.id)) return; // Skip if already rendered
            renderedPlayers.add(player.id);
            
            const element = createPlayerElement(player);
            spectatorTeamContainer.appendChild(element);
        });
        
        console.log(`Rendered teams - Red: ${gameState.teams.red.length}, Blue: ${gameState.teams.blue.length}, Spectators: ${gameState.teams.spectator.length}`);
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
        if (!gameState.hasOwnProperty('particles')) {
            gameState.particles = [];
            gameState.goalParticles = [];
            gameState.particlesEnabled = true;
            gameState.lastTrailTime = 0;
            gameState.trailFrequency = 50; // ms between trail particle spawns
            gameState.goalCelebrationActive = false;
            gameState.goalCelebrationStartTime = 0;
            gameState.goalCelebrationDuration = 2500; // 2.5 seconds
            console.log("Particle system initialized");
        }
        if (!gameState.gameActive) return;
        
        // Calculate delta time for smoother animations
        const now = Date.now();
        const delta = now - (gameState.lastFrameTime || now);
        gameState.lastFrameTime = now;
        
        // Send player input to server
        sendPlayerInput();
        
        // Perform client-side prediction if needed
        performClientPrediction();
        
        // Update particles - add this line
        updateAndRenderParticles(delta);
        
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
    function selectStadium(stadiumId) {
        gameState.selectedStadium = stadiumId;
        
        // Find the selected stadium
        const selected = stadiumOptions.find(stadium => stadium.id === stadiumId);
        
        // Update button text to show selection
        document.querySelector('#stadiumDropdownBtn span').textContent = selected.name;
        
        // Highlight the selected option
        const options = document.querySelectorAll('.stadium-option');
        options.forEach(opt => {
            if (opt.getAttribute('data-stadium-id') === stadiumId) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
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
        
        // Store the timestamp of the last input
        if (input.left || input.right || input.up || input.down) {
            currentPlayer.lastActiveInputTime = Date.now();
        }
        
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
        
        // Apply prediction with smoother transition
        if (dx !== 0 || dy !== 0) {
            // Active movement: apply normal acceleration-based movement
            // The prediction should be small but noticeable for responsiveness
            const PREDICTION_AMOUNT = 2.5; // Slightly increased for better responsiveness
            currentPlayer.x += dx * PREDICTION_AMOUNT;
            currentPlayer.y += dy * PREDICTION_AMOUNT;
            
            // Remember when player was last actively moving
            currentPlayer.lastActiveInputTime = Date.now();
        } else {
            // No input: apply friction-based sliding for a natural slowdown
            // (This simulates the server-side physics locally for better prediction)
            if (gameState.frictionEnabled) {
                // Apply client-side friction to match server's physics
                if (Math.abs(currentPlayer.vx) > 0.1 || Math.abs(currentPlayer.vy) > 0.1) {
                    // Predict friction effect on velocity
                    currentPlayer.vx *= gameState.frictionFactor;
                    currentPlayer.vy *= gameState.frictionFactor;
                    
                    // Apply predicted velocity
                    currentPlayer.x += currentPlayer.vx * 0.5; // Partial application to avoid overestimation
                    currentPlayer.y += currentPlayer.vy * 0.5;
                }
            }
        }
        
        // Smoothly interpolate to server position to correct errors
        // Use adaptive interpolation rate based on time since last active input
        const timeSinceInput = Date.now() - (currentPlayer.lastActiveInputTime || 0);
        
        // Calculate adaptive interpolation factorf
        // - When actively moving, use lower correction (more client authority)
        // - When sliding/not moving, use higher correction (more server authority)
        let CORRECTION_FACTOR;
        if (timeSinceInput < 100) {
            // Very recently active - minimal correction
            CORRECTION_FACTOR = 0.05;
        } else if (timeSinceInput < 300) {
            // Recently active - moderate correction
            CORRECTION_FACTOR = 0.08;
        } else {
            // No recent input - stronger correction
            CORRECTION_FACTOR = 0.12;
        }
        
        // Apply the correction
        currentPlayer.x = currentPlayer.x * (1 - CORRECTION_FACTOR) + currentPlayer.serverX * CORRECTION_FACTOR;
        currentPlayer.y = currentPlayer.y * (1 - CORRECTION_FACTOR) + currentPlayer.serverY * CORRECTION_FACTOR;
    }
    function initializeStadiumSelector() {
        console.log("Initializing horizontal stadium selector...");
        const stadiumDropdownBtn = document.getElementById('stadiumDropdownBtn');
        const stadiumDropdownContent = document.getElementById('stadiumDropdownContent');
        
        if (!stadiumDropdownBtn || !stadiumDropdownContent) {
            console.error("Stadium selector elements not found!");
            return;
        }
        
        // Clear existing content
        stadiumDropdownContent.innerHTML = '';
        
        // Add stadium options to the dropdown
        stadiumOptions.forEach(stadium => {
            console.log(`Adding stadium option: ${stadium.name}`);
            const option = document.createElement('div');
            option.className = 'stadium-option';
            option.setAttribute('data-stadium-id', stadium.id);
            
            // Create a description tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'stadium-tooltip';
            tooltip.textContent = stadium.description;
            
            option.innerHTML = `
                <div class="stadium-image-container">
                    <img src="${stadium.image}" alt="${stadium.name}" class="stadium-image">
                </div>
                <div class="stadium-info">
                    <h3>${stadium.name}</h3>
                    <span class="recommended">${stadium.recommendedPlayers}</span>
                </div>
            `;
            
            // Add the tooltip
            option.appendChild(tooltip);
            
            // Add click event handler
            option.onclick = function() {
                console.log(`Stadium selected: ${stadium.id}`);
                selectStadium(stadium.id);
                stadiumDropdownContent.classList.remove('show');
            };
            
            stadiumDropdownContent.appendChild(option);
        });
        
        // Toggle dropdown on button click
        stadiumDropdownBtn.onclick = function(e) {
            console.log("Stadium dropdown button clicked");
            e.preventDefault();
            e.stopPropagation();
            stadiumDropdownContent.classList.toggle('show');
        };
        
        // Close the dropdown if clicked outside
        document.addEventListener('click', function(e) {
            if (!stadiumDropdownBtn.contains(e.target) && !stadiumDropdownContent.contains(e.target)) {
                stadiumDropdownContent.classList.remove('show');
            }
        });
        
        // Position the dropdown directly under the button
        stadiumDropdownContent.style.position = 'absolute';
        stadiumDropdownContent.style.top = '100%';
        stadiumDropdownContent.style.left = '0';
        
        // Select default stadium
        selectStadium('medium');
        console.log("Horizontal stadium selector initialized");
    }
    
    function initializeParticleSystem() {
        // Add some properties to the gameState object to track particles
        gameState.lastTrailTime = 0;
        gameState.trailFrequency = 50; // ms between trail particle spawns
        gameState.goalCelebrationActive = false;
        gameState.goalCelebrationStartTime = 0;
        gameState.goalCelebrationDuration = 2500; // 2.5 seconds
    }
    
    // Render the game
    // Render the game
    function renderGame() {
        // Apply transformation to match stadium size
        if (gameState.canvasScale) {
            // Save current state
            ctx.save();
            
            // Apply scaling transformation
            ctx.scale(gameState.canvasScale.x, gameState.canvasScale.y);
            
            // Clear canvas - need to clear the ENTIRE canvas, not just the transformed area
            ctx.resetTransform(); // Remove transformation temporarily
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.scale(gameState.canvasScale.x, gameState.canvasScale.y); // Reapply transformation
            
            // Draw field, players, ball, etc. using GAME coordinates
            drawField();
            
            // Draw kickoff restrictions visualization BEFORE players
            if (gameState.kickoffRestrictions) {
                drawKickoffRestrictions();
            }
            
            drawPlayers();
            drawBall();
            
            // Render all particles
            renderParticles();
            
            // Draw special effects AFTER players
            if (gameState.kickoff) {
                drawKickoffCountdown();
            }
            
            // Restore original state
            ctx.restore();
        } else {
            // Default rendering without scaling
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawField();
            
            if (gameState.kickoffRestrictions) {
                drawKickoffRestrictions();
            }
            
            drawPlayers();
            drawBall();
            renderParticles();
            
            if (gameState.kickoff) {
                drawKickoffCountdown();
            }
        }
        
        // Draw UI elements that should not be scaled
        drawPing();
    }
    function drawKickoffRestrictions() {
        if (!gameState.kickoffTeam) return;
        
        // Draw semi-transparent center circle
        const kickoffColor = gameState.kickoffTeam === 'red' ? 
            'rgba(231, 76, 60, 0.15)' : 
            'rgba(52, 152, 219, 0.15)';
        
        // Get circle radius from stadium config if available
        const centerCircleRadius = gameState.stadiumConfig ? 
            Math.round(60 * (gameState.stadiumConfig.width / 1000)) : CENTER_CIRCLE_RADIUS;
        
        // Save context to restore later
        ctx.save();
        
        // Highlight center circle - Fill with lower opacity
        ctx.fillStyle = kickoffColor;
        ctx.beginPath();
        ctx.arc(fieldDimensions.centerX, fieldDimensions.centerY, centerCircleRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight center circle - Outline with pulsing effect
        const pulseSize = 1 + Math.sin(Date.now() / 200) * 0.5; // Subtle pulsing effect
        ctx.strokeStyle = gameState.kickoffTeam === 'red' ? 'rgba(231, 76, 60, 0.7)' : 'rgba(52, 152, 219, 0.7)';
        ctx.lineWidth = pulseSize;
        ctx.beginPath();
        ctx.arc(fieldDimensions.centerX, fieldDimensions.centerY, centerCircleRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Highlight the midline with lower opacity and thinner line
        ctx.strokeStyle = kickoffColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fieldDimensions.centerX, 0);
        ctx.lineTo(fieldDimensions.centerX, fieldDimensions.height);
        ctx.stroke();
        
        ctx.restore();
    }
    
    // Draw the field
    function drawField() {
        // Field background
        ctx.fillStyle = '#1a472a'; // Dark green
        ctx.fillRect(0, 0, fieldDimensions.width, fieldDimensions.height);
        
        // Use stadium values for all drawing
        const centerX = fieldDimensions.centerX;
        const centerY = fieldDimensions.centerY;
        const leftFence = fieldDimensions.leftFence;
        const rightFence = fieldDimensions.rightFence;
        
        // Get goal width from stadium config if available
        const goalWidth = gameState.stadiumConfig ? gameState.stadiumConfig.goalWidth : GOAL_WIDTH;
        const centerCircleRadius = gameState.stadiumConfig ? 
            Math.round(60 * (gameState.stadiumConfig.width / 1000)) : CENTER_CIRCLE_RADIUS;
        
        // Draw checkerboard pattern only inside fence area
        ctx.fillStyle = '#235c37'; // Slightly lighter green
        const patternSize = Math.round(30 * (fieldDimensions.width / 1000)); // Scale pattern size to field width
        
        // Only draw checkers within the playable area
        for (let x = leftFence; x < rightFence; x += patternSize) {
            for (let y = 0; y < fieldDimensions.height; y += patternSize) {
                // Only fill every other square for checkered pattern
                if ((Math.floor(x / patternSize) + Math.floor(y / patternSize)) % 2 === 0) {
                    const drawWidth = Math.min(patternSize, rightFence - x);
                    ctx.fillRect(x, y, drawWidth, patternSize);
                }
            }
        }
        
        // Center line - using exact center X
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, fieldDimensions.height);
        ctx.stroke();
        
        // Center circle - using exact center coordinates and scaled radius
        ctx.beginPath();
        ctx.arc(centerX, centerY, centerCircleRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Center spot (enlarged for visibility)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw goals and fence
        drawGoals();
        drawFence();
    }
    function setupCanvasScaling() {
        if (!gameState.stadiumConfig) {
            console.warn("No stadium configuration available for scaling!");
            return;
        }
        
        // Get physical and logical dimensions
        const physicalWidth = canvas.width;
        const physicalHeight = canvas.height;
        const logicalWidth = gameState.stadiumConfig.width;
        const logicalHeight = gameState.stadiumConfig.height;
        
        // Calculate scale factors
        const scaleX = physicalWidth / logicalWidth;
        const scaleY = physicalHeight / logicalHeight;
        
        // Store scale factors in gameState for use in rendering
        gameState.canvasScale = {
            x: scaleX,
            y: scaleY
        };
        
        console.log(`Canvas scaling factors: ${scaleX}x, ${scaleY}y`);
    }
    function resizeCanvasToStadium() {
        if (!gameState.stadiumConfig) {
            console.warn("No stadium configuration available for resizing canvas!");
            return resizeCanvas(); // Fall back to default resize
        }
        
        // Get available screen space
        const maxWidth = gameScreen.clientWidth;
        const maxHeight = gameScreen.clientHeight - 80; // Account for chat
        
        // Get stadium dimensions
        const stadiumRatio = gameState.stadiumConfig.width / gameState.stadiumConfig.height;
        
        // Calculate best fit within available space
        let canvasWidth, canvasHeight;
        
        if (maxWidth / stadiumRatio <= maxHeight) {
            // Width limited
            canvasWidth = maxWidth;
            canvasHeight = maxWidth / stadiumRatio;
        } else {
            // Height limited
            canvasHeight = maxHeight;
            canvasWidth = maxHeight * stadiumRatio;
        }
        
        // Apply dimensions
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        console.log(`Canvas resized to: ${canvas.width}x${canvas.height} for stadium: ${gameState.stadiumConfig.width}x${gameState.stadiumConfig.height}`);
        setupCanvasScaling();
    }
    
    // Draw goals
    // Draw goals
    function drawGoals() {
        // Get values from stadium config if available
        const centerX = fieldDimensions.centerX;
        const centerY = fieldDimensions.centerY;
        const leftFence = fieldDimensions.leftFence;
        const rightFence = fieldDimensions.rightFence;
        const goalWidth = gameState.stadiumConfig ? gameState.stadiumConfig.goalWidth : GOAL_WIDTH;
        
        // Left goal (red)
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(leftFence - 5, centerY, goalWidth / 2, Math.PI / 2, -Math.PI / 2);
        ctx.stroke();
        
        // Red goal post dots
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(leftFence, centerY - goalWidth / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(leftFence, centerY + goalWidth / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Right goal (blue)
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(rightFence + 5, centerY, goalWidth / 2, Math.PI / 2, -Math.PI / 2, true);
        ctx.stroke();
        
        // Blue goal post dots
        ctx.fillStyle = 'blue';
        ctx.beginPath();
        ctx.arc(rightFence, centerY - goalWidth / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(rightFence, centerY + goalWidth / 2, 6, 0, Math.PI * 2);
        ctx.fill();
        
        
        // Draw goal nets
        drawGoalNets();
    }
// Draw goal nets
//SCOS MOMENTAN PENTRU CA NU STIU SA IL FAC FRUMOS
function drawGoalNets() {
    const centerY = fieldDimensions.centerY;
    const leftFence = fieldDimensions.leftFence;
    const rightFence = fieldDimensions.rightFence;
    const goalWidth = gameState.stadiumConfig ? gameState.stadiumConfig.goalWidth : GOAL_WIDTH;
    const goalDepth = gameState.stadiumConfig ? gameState.stadiumConfig.goalDepth : GOAL_DEPTH;
    
    // Save context for restoration later
    ctx.save();
    
    // Parameters for circular net
    const spacing = Math.floor(goalWidth / 6); // Grid spacing based on goal size
    
    // Left goal net (red)
    // Calculate position
    const leftGoalRadius = goalWidth / 2;
    const leftGoalCenterX = leftFence;
    const leftGoalCenterY = centerY;
    
    // Add goal depth shading (optional)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.arc(leftGoalCenterX, leftGoalCenterY, leftGoalRadius, Math.PI * 1.5, Math.PI * 0.5, true);
    ctx.lineTo(leftGoalCenterX, leftGoalCenterY + leftGoalRadius);
    ctx.fill();
    
    // Draw red goal post markers
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(leftFence, centerY - goalWidth / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(leftFence, centerY + goalWidth / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Removed the white goal frame arc
    
    // Draw net lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    
    // Vertical lines
    for (let x = leftGoalCenterX - leftGoalRadius; x <= leftGoalCenterX; x += spacing) {
        const halfHeight = Math.sqrt(Math.pow(leftGoalRadius, 2) - Math.pow(x - leftGoalCenterX, 2));
        if (!isNaN(halfHeight)) {
            ctx.beginPath();
            ctx.moveTo(x, leftGoalCenterY - halfHeight);
            ctx.lineTo(x, leftGoalCenterY + halfHeight);
            ctx.stroke();
        }
    }
    
    // Horizontal lines
    for (let y = leftGoalCenterY - leftGoalRadius; y <= leftGoalCenterY + leftGoalRadius; y += spacing) {
        const halfWidth = Math.sqrt(Math.pow(leftGoalRadius, 2) - Math.pow(y - leftGoalCenterY, 2));
        if (!isNaN(halfWidth)) {
            ctx.beginPath();
            ctx.moveTo(leftGoalCenterX - halfWidth, y);
            ctx.lineTo(leftGoalCenterX, y);
            ctx.stroke();
        }
    }
    
    // Right goal net (blue)
    // Calculate position
    const rightGoalRadius = goalWidth / 2;
    const rightGoalCenterX = rightFence;
    const rightGoalCenterY = centerY;
    
    // Add goal depth shading (optional)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.arc(rightGoalCenterX, rightGoalCenterY, rightGoalRadius, Math.PI * 0.5, Math.PI * 1.5, true);
    ctx.lineTo(rightGoalCenterX, rightGoalCenterY - rightGoalRadius);
    ctx.fill();
    
    // Draw blue goal post markers
    ctx.fillStyle = 'blue';
    ctx.beginPath();
    ctx.arc(rightFence, centerY - goalWidth / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightFence, centerY + goalWidth / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Removed the white goal frame arc
    
    // Draw net lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    
    // Vertical lines
    for (let x = rightGoalCenterX; x <= rightGoalCenterX + rightGoalRadius; x += spacing) {
        const halfHeight = Math.sqrt(Math.pow(rightGoalRadius, 2) - Math.pow(x - rightGoalCenterX, 2));
        if (!isNaN(halfHeight)) {
            ctx.beginPath();
            ctx.moveTo(x, rightGoalCenterY - halfHeight);
            ctx.lineTo(x, rightGoalCenterY + halfHeight);
            ctx.stroke();
        }
    }
    
    // Horizontal lines
    for (let y = rightGoalCenterY - rightGoalRadius; y <= rightGoalCenterY + rightGoalRadius; y += spacing) {
        const halfWidth = Math.sqrt(Math.pow(rightGoalRadius, 2) - Math.pow(y - rightGoalCenterY, 2));
        if (!isNaN(halfWidth)) {
            ctx.beginPath();
            ctx.moveTo(rightGoalCenterX, y);
            ctx.lineTo(rightGoalCenterX + halfWidth, y);
            ctx.stroke();
        }
    }
    
    // Restore context
    ctx.restore();
}


// Draw fence
function drawFence() {
    const leftFence = fieldDimensions.leftFence;
    const rightFence = fieldDimensions.rightFence;
    const centerY = fieldDimensions.centerY;
    const fieldHeight = fieldDimensions.height;
    const goalWidth = gameState.stadiumConfig ? gameState.stadiumConfig.goalWidth : GOAL_WIDTH;
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    // Left side (connecting with goal posts)
    ctx.moveTo(leftFence, 0);
    ctx.lineTo(leftFence, centerY - goalWidth / 2);
    
    // Resume after left goal
    ctx.moveTo(leftFence, centerY + goalWidth / 2);
    ctx.lineTo(leftFence, fieldHeight);
    
    // Bottom
    ctx.lineTo(rightFence, fieldHeight);
    
    // Right side (connecting with goal posts)
    ctx.lineTo(rightFence, centerY + goalWidth / 2);
    
    // Resume after right goal
    ctx.moveTo(rightFence, centerY - goalWidth / 2);
    ctx.lineTo(rightFence, 0);
    
    // Top
    ctx.lineTo(leftFence, 0);
    
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
function transformGameToCanvas(gameX, gameY) {
    if (!gameState.canvasScale) {
        // If no scaling defined, use 1:1 mapping
        return { x: gameX, y: gameY };
    }
    
    return {
        x: gameX * gameState.canvasScale.x,
        y: gameY * gameState.canvasScale.y
    };
}
function transformCanvasToGame(canvasX, canvasY) {
    if (!gameState.canvasScale) {
        // If no scaling defined, use 1:1 mapping
        return { x: canvasX, y: canvasY };
    }
    
    return {
        x: canvasX / gameState.canvasScale.x,
        y: canvasY / gameState.canvasScale.y
    };
}
// Draw players
function drawPlayers() {
    if (!gameState.players) return;
    
    // Draw all players using GAME coordinates
    Object.values(gameState.players).forEach(player => {
        if (player.team === 'spectator') return;
        
        // Draw motion trail if player is moving fast enough
        drawPlayerMotionTrail(player);
        
        // Get player radius from stadium config if available
        const playerRadius = gameState.stadiumConfig ? 
            gameState.stadiumConfig.playerRadius : PLAYER_RADIUS;
        
        // Set color based on team
        if (player.team === 'red') {
            ctx.fillStyle = '#e74c3c';
        } else {
            ctx.fillStyle = '#3498db';
        }
        
        // Draw player circle
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius || playerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Player outline
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.radius || playerRadius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Player name - adjust for canvas scaling
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
                ctx.arc(player.x, player.y, (player.radius || playerRadius) + pulseSize, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Default current player indicator
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.arc(player.x, player.y, (player.radius || playerRadius) + 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            // Only draw "You" text for current player
            ctx.fillText('You', player.x, player.y - (player.radius || playerRadius) - 5);
        } else {
            // Draw name for other players
            ctx.fillText(player.name, player.x, player.y - (player.radius || playerRadius) - 5);
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
    
    // Get ball radius from stadium config if available
    const ballRadius = gameState.stadiumConfig ? 
        gameState.stadiumConfig.ballRadius : BALL_RADIUS;
    
    // Ball circle
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius || ballRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Ball outline
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(gameState.ball.x, gameState.ball.y, gameState.ball.radius || ballRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.ellipse(
        gameState.ball.x, 
        gameState.ball.y + (gameState.ball.radius || ballRadius) + 2, 
        (gameState.ball.radius || ballRadius) * 0.8, 
        (gameState.ball.radius || ballRadius) * 0.3, 
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
function updateAndRenderParticles(delta) {
    if (!gameState.particlesEnabled) return;
    
    const currentTime = Date.now();
    
    // Process goal celebration if active
    if (gameState.goalCelebrationActive) {
        // Check if celebration has ended
        if (currentTime - gameState.goalCelebrationStartTime > gameState.goalCelebrationDuration) {
            gameState.goalCelebrationActive = false;
            gameState.goalParticles = []; // Clear particles
        } else {
            // Spawn new celebration particles if needed
            const elapsedTime = currentTime - gameState.goalCelebrationStartTime;
            const celebrationProgress = elapsedTime / gameState.goalCelebrationDuration;
            
            // Reduce spawn rate over time
            if (celebrationProgress < 0.8 && Math.random() < (0.6 * (1 - celebrationProgress))) {
                const spawnCount = Math.floor(3 + Math.random() * 2); // 3-4 particles per batch
                for (let i = 0; i < spawnCount; i++) {
                    spawnGoalParticle(gameState.goalScoredTeam, gameState.goalX, gameState.goalY);
                }
            }
        }
    }
    
    // Update player trail particles
    if (gameState.gameActive && currentTime - gameState.lastTrailTime > gameState.trailFrequency) {
        gameState.lastTrailTime = currentTime;
        
        // Generate trail particles for fast-moving players
        Object.values(gameState.players).forEach(player => {
            if (player.team === 'spectator') return;
            
            // Calculate player speed
            const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
            
            // Only create trail for players moving above a certain speed
            if (speed > 3) {
                // Spawn more particles for faster players
                const particleCount = Math.min(Math.floor(speed / 2), 3);
                
                for (let i = 0; i < particleCount; i++) {
                    spawnTrailParticle(player);
                }
            }
        });
        
        // Generate subtle trail for fast-moving ball
        if (gameState.ball) {
            const ballSpeed = Math.sqrt(gameState.ball.vx * gameState.ball.vx + gameState.ball.vy * gameState.ball.vy);
            if (ballSpeed > 5) {
                const particleCount = Math.min(Math.floor(ballSpeed / 3), 2);
                for (let i = 0; i < particleCount; i++) {
                    spawnBallTrailParticle(gameState.ball);
                }
            }
        }
    }
    
    // Update trail particles
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const particle = gameState.particles[i];
        
        // Update particle position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Update particle lifetime
        particle.life -= delta || 16; // Use 16ms as default if delta not provided
        
        // Apply drag/friction
        particle.vx *= 0.96;
        particle.vy *= 0.96;
        
        // Fade out based on remaining life
        particle.opacity = (particle.life / particle.maxLife) * particle.initialOpacity;
        
        // Remove dead particles
        if (particle.life <= 0) {
            gameState.particles.splice(i, 1);
        }
    }
    
    // Update goal celebration particles
    for (let i = gameState.goalParticles.length - 1; i >= 0; i--) {
        const particle = gameState.goalParticles[i];
        
        // Update particle position
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Apply gravity
        particle.vy += 0.03;
        
        // Apply drag
        particle.vx *= 0.98;
        particle.vy *= 0.98;
        
        // Update particle lifetime
        particle.life -= delta || 16;
        
        // Update size and opacity
        particle.size = particle.initialSize * (particle.life / particle.maxLife);
        particle.opacity = (particle.life / particle.maxLife) * particle.initialOpacity;
        
        // Remove dead particles
        if (particle.life <= 0) {
            gameState.goalParticles.splice(i, 1);
        }
    }
}
function spawnTrailParticle(player) {
    if (!player || !player.radius) return;
    
    // Calculate offset from player center
    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetDistance = player.radius * Math.random() * 0.7;
    
    // Create particle
    const particle = {
        x: player.x + Math.cos(offsetAngle) * offsetDistance,
        y: player.y + Math.sin(offsetAngle) * offsetDistance,
        vx: -(player.vx || 0) * (0.1 + Math.random() * 0.1), // Opposite direction of movement
        vy: -(player.vy || 0) * (0.1 + Math.random() * 0.1),
        size: 2 + Math.random() * 2,
        life: 400 + Math.random() * 200, // 400-600ms lifetime
        maxLife: 600,
        color: player.team === 'red' ? '#e74c3c' : '#3498db',
        initialOpacity: 0.3 + Math.random() * 0.2, // Subtle opacity
        opacity: 0.5,
        type: 'trail'
    };
    
    if (!gameState.particles) {
        gameState.particles = [];
    }
    
    gameState.particles.push(particle);
}
function spawnBallTrailParticle(ball) {
    if (!ball || !ball.radius) return;
    
    // Calculate offset from ball center
    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetDistance = ball.radius * Math.random() * 0.5;
    
    // Create particle
    const particle = {
        x: ball.x + Math.cos(offsetAngle) * offsetDistance,
        y: ball.y + Math.sin(offsetAngle) * offsetDistance,
        vx: -(ball.vx || 0) * (0.05 + Math.random() * 0.05), // Opposite direction of movement
        vy: -(ball.vy || 0) * (0.05 + Math.random() * 0.05),
        size: 1.5 + Math.random() * 1.5,
        life: 300 + Math.random() * 200, // 300-500ms lifetime
        maxLife: 500,
        color: '#ffffff',
        initialOpacity: 0.2 + Math.random() * 0.15, // Very subtle opacity
        opacity: 0.3,
        type: 'ball_trail'
    };
    
    if (!gameState.particles) {
        gameState.particles = [];
    }
    
    gameState.particles.push(particle);
}
function spawnGoalParticle(team, goalX, goalY) {
    if (!goalX || !goalY) return;
    
    // Team color
    const teamColor = team === 'red' ? '#e74c3c' : '#3498db';
    
    // Random colors, primarily team color but with some whites and other accents
    let color;
    const colorRandom = Math.random();
    if (colorRandom < 0.7) {
        color = teamColor; // 70% team color
    } else if (colorRandom < 0.85) {
        color = '#ffffff'; // 15% white
    } else {
        color = team === 'red' ? '#f39c12' : '#2ecc71'; // 15% accent color
    }
    
    // Calculate spawn position near goal posts
    const spawnOffsetX = (Math.random() * 80) - 40; // -40 to 40 pixels
    const spawnOffsetY = (Math.random() * 80) - 40; // -40 to 40 pixels
    
    // Calculate initial velocity - explode outward from goal
    const angle = Math.atan2(spawnOffsetY, spawnOffsetX);
    const speed = 1 + Math.random() * 2; // Base speed
    
    // Create particle
    const particle = {
        x: goalX + spawnOffsetX,
        y: goalY + spawnOffsetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1 - Math.random(),  // Initial upward boost
        size: 2 + Math.random() * 3,
        initialSize: 2 + Math.random() * 3,
        life: 800 + Math.random() * 1200, // 0.8-2 seconds lifetime
        maxLife: 2000,
        color: color,
        initialOpacity: 0.5 + Math.random() * 0.5,
        opacity: 0.7,
        type: 'goal',
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 5
    };
    
    if (!gameState.goalParticles) {
        gameState.goalParticles = [];
    }
    
    gameState.goalParticles.push(particle);
}
function renderParticles() {
    // Make sure particle system is initialized
    if (!gameState.hasOwnProperty('particles')) {
        gameState.particles = [];
        gameState.goalParticles = [];
        gameState.particlesEnabled = true;
        gameState.lastTrailTime = 0;
        gameState.trailFrequency = 50;
        gameState.goalCelebrationActive = false;
        gameState.goalCelebrationStartTime = 0;
        gameState.goalCelebrationDuration = 2500;
        console.log("Particle system initialized during rendering");
        return; // Skip first frame to allow initialization
    }
    
    if (!gameState.particlesEnabled) return;
    
    // Render trail particles
    if (gameState.particles && gameState.particles.length > 0) {
        gameState.particles.forEach(particle => {
            if (!particle) return; // Skip undefined particles
            
            ctx.save();
            ctx.globalAlpha = particle.opacity || 0.5;
            ctx.fillStyle = particle.color || '#ffffff';
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size || 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }
    
    // Render goal celebration particles
    if (gameState.goalParticles && gameState.goalParticles.length > 0) {
        gameState.goalParticles.forEach(particle => {
            if (!particle) return; // Skip undefined particles
            
            ctx.save();
            ctx.globalAlpha = particle.opacity || 0.5;
            ctx.fillStyle = particle.color || '#ffffff';
            
            // Draw different shapes for variety
            if (Math.random() > 0.7) {
                // Squares/diamonds
                ctx.translate(particle.x, particle.y);
                ctx.rotate((particle.rotation || 0) * Math.PI/180);
                ctx.fillRect(-(particle.size || 2)/2, -(particle.size || 2)/2, particle.size || 2, particle.size || 2);
            } else {
                // Circles
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size || 2, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
            
            // Update particle rotation if it exists
            if (particle.rotation !== undefined && particle.rotationSpeed !== undefined) {
                particle.rotation += particle.rotationSpeed;
            }
        });
    }
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
