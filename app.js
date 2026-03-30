const roomCardsEl = document.getElementById("roomCards");
const healthEl = document.getElementById("health");
const dungeonCountEl = document.getElementById("dungeonCount");
const discardCountEl = document.getElementById("discardCount");
const weaponStatusEl = document.getElementById("weaponStatus");
const weaponCardEl = document.getElementById("weaponCard");
const weaponLimitEl = document.getElementById("weaponLimit");
const slainListEl = document.getElementById("slainList");
const turnInfoEl = document.getElementById("turnInfo");
const logEl = document.getElementById("log");
const avoidBtn = document.getElementById("avoidBtn");
const endTurnBtn = document.getElementById("endTurnBtn");
const newGameBtn = document.getElementById("newGameBtn");
const dungeonPileEl = document.getElementById("dungeonPile");

const monsterDialog = document.getElementById("monsterDialog");
const monsterTitle = document.getElementById("monsterTitle");
const monsterDesc = document.getElementById("monsterDesc");
const useWeaponBtn = document.getElementById("useWeaponBtn");
const barehandBtn = document.getElementById("barehandBtn");

const gameOverDialog = document.getElementById("gameOverDialog");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverDesc = document.getElementById("gameOverDesc");

const SUITS = ["♣", "♠", "♦", "♥"];
const VALUES = [
  { name: "2", value: 2 },
  { name: "3", value: 3 },
  { name: "4", value: 4 },
  { name: "5", value: 5 },
  { name: "6", value: 6 },
  { name: "7", value: 7 },
  { name: "8", value: 8 },
  { name: "9", value: 9 },
  { name: "10", value: 10 },
  { name: "J", value: 11 },
  { name: "Q", value: 12 },
  { name: "K", value: 13 },
  { name: "A", value: 14 },
];

let dungeon = [];
let discard = [];
let room = [];
let health = 20;
let weapon = null; // { value, name, lastSlain, slain: [] }
let turn = 1;
let avoidedLastRoom = false;
let selectionsThisTurn = 0;
let potionUsedThisTurn = false;
let lastResolved = null; // { type, value }
let gameOver = false;
let targetSelections = 3;

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const card of VALUES) {
      const isRed = suit === "♦" || suit === "♥";
      if (isRed && (card.name === "J" || card.name === "Q" || card.name === "K" || card.name === "A")) {
        continue;
      }
      const type = suit === "♣" || suit === "♠" ? "monster" : suit === "♦" ? "weapon" : "potion";
      if (type === "weapon" || type === "potion") {
        if (card.value < 2 || card.value > 10) {
          continue;
        }
      }
      deck.push({
        id: `${card.name}${suit}-${type}`,
        name: `${card.name}${suit}`,
        value: card.value,
        type,
      });
    }
  }
  return shuffle(deck);
}

function log(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";
  entry.textContent = message;
  logEl.prepend(entry);
}

function drawToRoom() {
  if (dungeonPileEl) {
    dungeonPileEl.classList.remove("dealing");
    void dungeonPileEl.offsetWidth;
    dungeonPileEl.classList.add("dealing");
  }
  while (room.length < 4 && dungeon.length > 0) {
    room.push(dungeon.shift());
  }
  targetSelections = Math.min(3, room.length);
}

function updateUI() {
  healthEl.textContent = health;
  dungeonCountEl.textContent = dungeon.length;
  discardCountEl.textContent = discard.length;
  turnInfoEl.textContent = `${turn}`;

  weaponStatusEl.textContent = weapon ? `${weapon.name} (value ${weapon.value})` : "None";
  weaponCardEl.textContent = weapon ? weapon.name : "No weapon";
  weaponCardEl.classList.toggle("weapon", Boolean(weapon));
  weaponLimitEl.textContent = weapon?.lastSlain ?? "-";

  slainListEl.innerHTML = "";
  if (weapon && weapon.slain.length > 0) {
    weapon.slain.forEach((monster) => {
      const tag = document.createElement("span");
      tag.className = "slain-tag";
      tag.textContent = monster.name;
      slainListEl.append(tag);
    });
  }

  roomCardsEl.innerHTML = "";
  room.forEach((card, index) => {
    const cardEl = document.createElement("button");
    cardEl.className = `card ${card.type} deal`;
    cardEl.style.animationDelay = `${index * 0.08}s`;
    if (gameOver || selectionsThisTurn >= targetSelections) {
      cardEl.classList.add("disabled");
      cardEl.disabled = true;
    }
    cardEl.innerHTML = `
      <div class="card-title">${card.name}</div>
      <div class="card-sub">${card.type}</div>
    `;
    cardEl.addEventListener("click", () => handleCardClick(index));
    roomCardsEl.append(cardEl);
  });

  avoidBtn.disabled = gameOver || avoidedLastRoom || room.length < 4 || selectionsThisTurn > 0;
  endTurnBtn.disabled = gameOver || selectionsThisTurn < targetSelections;
}

function startGame() {
  dungeon = buildDeck();
  discard = [];
  room = [];
  health = 20;
  weapon = null;
  turn = 1;
  avoidedLastRoom = false;
  selectionsThisTurn = 0;
  potionUsedThisTurn = false;
  lastResolved = null;
  gameOver = false;
  targetSelections = 3;
  logEl.innerHTML = "";
  log("New game started.");
  drawToRoom();
  updateUI();
}

function canUseWeaponOn(monster) {
  if (!weapon) return false;
  if (weapon.lastSlain === null) return true;
  return monster.value <= weapon.lastSlain;
}

function discardWeapon() {
  if (!weapon) return;
  discard.push({ type: "weapon", name: weapon.name, value: weapon.value });
  weapon.slain.forEach((monster) => discard.push(monster));
  weapon = null;
}

function equipWeapon(card) {
  discardWeapon();
  weapon = {
    name: card.name,
    value: card.value,
    lastSlain: null,
    slain: [],
  };
  discard.push(card);
  log(`Equipped weapon ${card.name} (value ${card.value}).`);
}

function applyPotion(card) {
  if (potionUsedThisTurn) {
    discard.push(card);
    log(`Discarded extra potion ${card.name}. Already used one this turn.`);
    return;
  }
  potionUsedThisTurn = true;
  const before = health;
  health = Math.min(20, health + card.value);
  discard.push(card);
  const healed = health - before;
  log(`Used potion ${card.name}. Healed ${healed}.`);
  lastResolved = { type: "potion", value: card.value };
}

function fightMonster(card, method) {
  if (method === "weapon" && weapon) {
    const damage = Math.max(0, card.value - weapon.value);
    health -= damage;
    weapon.lastSlain = card.value;
    weapon.slain.push(card);
    log(`Fought ${card.name} with weapon. Took ${damage} damage.`);
  } else {
    health -= card.value;
    discard.push(card);
    log(`Fought ${card.name} barehanded. Took ${card.value} damage.`);
  }
  lastResolved = { type: "monster", value: card.value };
}

function handleCardClick(index) {
  if (gameOver || selectionsThisTurn >= targetSelections) return;

  const card = room[index];
  if (!card) return;

  if (card.type === "weapon") {
    equipWeapon(card);
    room.splice(index, 1);
    selectionsThisTurn += 1;
    updateTurnState();
  } else if (card.type === "potion") {
    applyPotion(card);
    room.splice(index, 1);
    selectionsThisTurn += 1;
    updateTurnState();
  } else if (card.type === "monster") {
    const canUseWeapon = canUseWeaponOn(card);
    if (weapon && canUseWeapon) {
      monsterTitle.textContent = `Monster ${card.name}`;
      monsterDesc.textContent = `Choose how to fight. Weapon value ${weapon.value}.`;
      useWeaponBtn.disabled = false;
      monsterDialog.showModal();

      const handleChoice = (event) => {
        monsterDialog.removeEventListener("close", handleChoice);
        const choice = monsterDialog.returnValue;
        const method = choice === "weapon" ? "weapon" : "barehand";
        fightMonster(card, method);
        room.splice(index, 1);
        selectionsThisTurn += 1;
        updateTurnState();
      };

      monsterDialog.addEventListener("close", handleChoice);
    } else {
      fightMonster(card, "barehand");
      room.splice(index, 1);
      selectionsThisTurn += 1;
      updateTurnState();
    }
  }
}

function updateTurnState() {
  if (health <= 0) {
    endGame(false);
    return;
  }

  if (selectionsThisTurn >= targetSelections) {
    endTurnBtn.disabled = false;
  }
  updateUI();
}

function endTurn() {
  if (selectionsThisTurn < targetSelections || gameOver) return;
  selectionsThisTurn = 0;
  potionUsedThisTurn = false;
  avoidedLastRoom = false;
  turn += 1;

  drawToRoom();
  updateUI();

  if (dungeon.length === 0 && room.length === 0) {
    endGame(true);
  }
}

function avoidRoom() {
  if (avoidedLastRoom || room.length < 4 || selectionsThisTurn > 0) return;
  dungeon.push(...room);
  room = [];
  avoidedLastRoom = true;
  selectionsThisTurn = 0;
  potionUsedThisTurn = false;
  turn += 1;
  log("Skipped the room. Cards placed at the bottom of the dungeon.");
  drawToRoom();
  updateUI();
}

function remainingMonsterPenalty() {
  const remainingMonsters = dungeon.filter((card) => card.type === "monster");
  return remainingMonsters.reduce((sum, card) => sum + card.value, 0);
}

function endGame(won) {
  gameOver = true;
  let score = 0;
  if (won) {
    score = health;
    if (health === 20 && lastResolved?.type === "potion") {
      score = health + lastResolved.value;
    }
    gameOverTitle.textContent = "You Escaped!";
    gameOverDesc.textContent = `Final score: ${score}. Remaining health: ${health}.`;
    log(`Dungeon cleared! Final score ${score}.`);
  } else {
    const penalty = remainingMonsterPenalty();
    score = health - penalty;
    gameOverTitle.textContent = "Defeated";
    gameOverDesc.textContent = `Final score: ${score}. Health reached ${health}.`;
    log(`You were defeated. Final score ${score}.`);
  }
  gameOverDialog.showModal();
  updateUI();
}

avoidBtn.addEventListener("click", avoidRoom);
endTurnBtn.addEventListener("click", endTurn);
newGameBtn.addEventListener("click", startGame);

gameOverDialog.addEventListener("close", (event) => {
  if (gameOverDialog.returnValue === "restart") {
    startGame();
  }
});

startGame();
