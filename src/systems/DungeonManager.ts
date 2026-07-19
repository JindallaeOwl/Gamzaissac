import {
  BOSS_ROOM_TEMPLATES,
  COMBAT_ROOM_TEMPLATES,
  REWARD_ROOM_TEMPLATE,
  START_ROOM_TEMPLATE,
  TREASURE_ROOM_TEMPLATE,
  type RoomType,
} from '../data/rooms';
import { DIRECTIONS, OPPOSITE_DIRECTION, type Direction, moveCoord } from '../utils/directions';
import { randomOf, shuffled, type RandomSource } from '../utils/random';
import type { RewardDrop } from './RewardSystem';

export interface PendingRoomReward {
  reward: RewardDrop;
  x: number;
  y: number;
}

export interface GridCoord {
  x: number;
  y: number;
}

export interface RoomNode {
  id: string;
  coord: GridCoord;
  type: RoomType;
  templateId: string;
  exits: Direction[];
  cleared: boolean;
  discovered: boolean;
  rewardClaimed: boolean;
  rewardItemId?: string;
  treasureUnlocked: boolean;
  treasureClaimed: boolean;
  bossRewardClaimed: boolean;
  bossRewardItemId?: string;
  obstacleHealth?: number[];
  pendingReward?: PendingRoomReward;
}

export class DungeonManager {
  private rooms = new Map<string, RoomNode>();
  private currentKey = '0,0';

  floor = 1;

  constructor(private readonly random: RandomSource = Math.random) {}

  generateFloor(floor: number): void {
    this.floor = floor;
    this.rooms.clear();

    const startNode = this.createRoom({ x: 0, y: 0 }, 'start', START_ROOM_TEMPLATE.id);
    startNode.cleared = true;
    startNode.discovered = true;
    this.currentKey = this.keyFor(startNode.coord);

    const eastCombat = this.createRoom(
      moveCoord(startNode.coord, 'east'),
      'combat',
      this.pickCombatTemplateId(),
    );
    const southCombat = this.createRoom(
      moveCoord(startNode.coord, 'south'),
      'combat',
      this.pickCombatTemplateId(),
    );
    this.connectRooms(startNode, eastCombat, 'east');
    this.connectRooms(startNode, southCombat, 'south');

    const extraCombatCount = Math.max(0, (floor === 1 ? 3 : Math.min(6, 3 + floor)) - 2);
    let cursor = eastCombat;

    for (let i = 0; i < extraCombatCount; i += 1) {
      const direction = this.pickFreeDirection(cursor) ?? this.pickFreeDirection(eastCombat);

      if (!direction) {
        break;
      }

      const nextNode = this.createRoom(
        moveCoord(cursor.coord, direction),
        'combat',
        this.pickCombatTemplateId(),
      );
      this.connectRooms(cursor, nextNode, direction);
      cursor = nextNode;
    }

    this.addTreasureRoom(southCombat);
    this.addRewardRoom(eastCombat);
    this.addBossRoom(cursor);
  }

  getCurrentRoom(): RoomNode {
    const room = this.rooms.get(this.currentKey);

    if (!room) {
      throw new Error(`Current room missing: ${this.currentKey}`);
    }

    return room;
  }

  getRooms(): RoomNode[] {
    return [...this.rooms.values()];
  }

  move(direction: Direction): RoomNode | null {
    const currentRoom = this.getCurrentRoom();

    if (!currentRoom.exits.includes(direction)) {
      return null;
    }

    const targetKey = this.keyFor(moveCoord(currentRoom.coord, direction));
    const targetRoom = this.rooms.get(targetKey);

    if (!targetRoom) {
      return null;
    }

    this.currentKey = targetKey;
    targetRoom.discovered = true;
    return targetRoom;
  }

  peek(direction: Direction): RoomNode | null {
    const currentRoom = this.getCurrentRoom();

    if (!currentRoom.exits.includes(direction)) {
      return null;
    }

    return this.getNeighbor(currentRoom, direction);
  }

  getNeighbor(room: RoomNode, direction: Direction): RoomNode | null {
    return this.rooms.get(this.keyFor(moveCoord(room.coord, direction))) ?? null;
  }

  markCurrentCleared(): boolean {
    const currentRoom = this.getCurrentRoom();

    if (currentRoom.cleared) {
      return false;
    }

    currentRoom.cleared = true;
    return true;
  }

  markCurrentRewardClaimed(): void {
    this.getCurrentRoom().rewardClaimed = true;
  }

  markCurrentTreasureClaimed(): void {
    this.getCurrentRoom().treasureClaimed = true;
  }

  markCurrentBossRewardClaimed(): void {
    this.getCurrentRoom().bossRewardClaimed = true;
  }

  clearPendingReward(roomId: string): void {
    const room = this.rooms.get(roomId);

    if (room) {
      room.pendingReward = undefined;
    }
  }

  unlockRoom(roomId: string): void {
    const room = this.rooms.get(roomId);

    if (room) {
      room.treasureUnlocked = true;
    }
  }

  getCombatRoomsRemaining(): number {
    return this.getRooms().filter((room) => room.type === 'combat' && !room.cleared).length;
  }

  getBossRoomsRemaining(): number {
    return this.getRooms().filter((room) => room.type === 'boss' && !room.cleared).length;
  }

  isFloorObjectiveCleared(): boolean {
    return this.getCombatRoomsRemaining() === 0 && this.getBossRoomsRemaining() === 0;
  }

  private createRoom(coord: GridCoord, type: RoomType, templateId: string): RoomNode {
    const key = this.keyFor(coord);
    const node: RoomNode = {
      id: key,
      coord,
      type,
      templateId,
      exits: [],
      cleared: type !== 'combat' && type !== 'boss',
      discovered: false,
      rewardClaimed: false,
      treasureUnlocked: type !== 'treasure',
      treasureClaimed: false,
      bossRewardClaimed: false,
    };

    this.rooms.set(key, node);
    return node;
  }

  private connectRooms(from: RoomNode, to: RoomNode, direction: Direction): void {
    if (!from.exits.includes(direction)) {
      from.exits.push(direction);
    }

    const opposite = OPPOSITE_DIRECTION[direction];

    if (!to.exits.includes(opposite)) {
      to.exits.push(opposite);
    }
  }

  private findNodeWithFreeExit(node: RoomNode): RoomNode | null {
    return this.pickFreeDirection(node) ? node : null;
  }

  private findAnyNodeWithFreeExit(): RoomNode | null {
    const candidates = shuffled(this.getRooms(), this.random).filter((room) =>
      this.pickFreeDirection(room),
    );
    return candidates.length > 0 ? randomOf(candidates, this.random) : null;
  }

  private pickFreeDirection(node: RoomNode): Direction | null {
    for (const direction of shuffled(DIRECTIONS, this.random)) {
      const nextCoord = moveCoord(node.coord, direction);

      if (!this.rooms.has(this.keyFor(nextCoord))) {
        return direction;
      }
    }

    return null;
  }

  private addExtraConnections(): void {
    for (const room of this.getRooms()) {
      if (this.random() > 0.22) {
        continue;
      }

      const direction = randomOf(DIRECTIONS, this.random);
      const neighbor = this.rooms.get(this.keyFor(moveCoord(room.coord, direction)));

      if (neighbor) {
        this.connectRooms(room, neighbor, direction);
      }
    }
  }

  private addTreasureRoom(preferredBase?: RoomNode): void {
    const baseNode =
      preferredBase && this.pickFreeDirection(preferredBase)
        ? preferredBase
        : this.findAnyNodeWithFreeExit();

    if (!baseNode) {
      return;
    }

    const direction = this.pickFreeDirection(baseNode);

    if (!direction) {
      return;
    }

    const treasureNode = this.createRoom(
      moveCoord(baseNode.coord, direction),
      'treasure',
      TREASURE_ROOM_TEMPLATE.id,
    );
    this.connectRooms(baseNode, treasureNode, direction);
  }

  private addRewardRoom(preferredBase?: RoomNode): void {
    const baseNode =
      preferredBase && this.pickFreeDirection(preferredBase)
        ? preferredBase
        : this.findAnyNodeWithFreeExit();

    if (!baseNode) {
      return;
    }

    const direction = this.pickFreeDirection(baseNode);

    if (!direction) {
      return;
    }

    const rewardNode = this.createRoom(
      moveCoord(baseNode.coord, direction),
      'reward',
      REWARD_ROOM_TEMPLATE.id,
    );
    this.connectRooms(baseNode, rewardNode, direction);
  }

  private addBossRoom(preferredBase: RoomNode): void {
    const baseNode = this.pickFreeDirection(preferredBase)
      ? preferredBase
      : (this.findAnyNodeWithFreeExit() ?? preferredBase);
    const direction = this.pickFreeDirection(baseNode);

    if (!direction) {
      return;
    }

    const bossNode = this.createRoom(
      moveCoord(baseNode.coord, direction),
      'boss',
      BOSS_ROOM_TEMPLATES[(this.floor - 1) % BOSS_ROOM_TEMPLATES.length].id,
    );
    this.connectRooms(baseNode, bossNode, direction);
  }

  private pickCombatTemplateId(): string {
    return randomOf(COMBAT_ROOM_TEMPLATES, this.random).id;
  }

  private keyFor(coord: GridCoord): string {
    return `${coord.x},${coord.y}`;
  }
}
