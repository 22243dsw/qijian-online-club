import { createServer } from 'node:http'
import { randomUUID, createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { WebSocketServer } from 'ws'

const port = Number(process.env.PORT || 3001)
const users = new Map()
const sessions = new Map()
const rooms = new Map()
const sockets = new Set()
const redXiangqi = new Set(['車', '馬', '相', '仕', '帥', '炮', '兵'])
const blackXiangqi = new Set(['车', '马', '象', '士', '将', '炮', '卒'])
const xiangqiKind = { 車: '车', 车: '车', 馬: '马', 马: '马', 相: '象', 象: '象', 仕: '士', 士: '士', 帥: '将', 将: '将', 炮: '炮', 兵: '兵', 卒: '兵' }

const digest = (value) => createHash('sha256').update(value).digest('hex')
const send = (socket, type, payload = {}) => socket.readyState === 1 && socket.send(JSON.stringify({ type, ...payload }))
const userFor = (socket) => sessions.get(socket.sessionToken)
const roomSummary = (room) => ({ id: room.id, name: room.name, game: room.game, players: room.players.length, maxPlayers: 2, password: Boolean(room.passwordHash), status: room.players.length > 1 ? '进行中' : '等待中', createdBy: room.createdBy, winner: room.winner || '' })

function setupBoard(game) {
  if (game === '围棋') return Array(19 * 19).fill(null)
  if (game === '五子棋') return Array(15 * 15).fill(null)
  if (game === '国际象棋') return ['r','n','b','q','k','b','n','r', ...Array(8).fill('p'), ...Array(32).fill(null), ...Array(8).fill('P'), 'R','N','B','Q','K','B','N','R']
  const board = Array(90).fill(null)
  ;['車','馬','相','仕','帥','仕','相','馬','車'].forEach((piece, index) => { board[81 + index] = piece })
  ;['车','马','象','士','将','士','象','马','车'].forEach((piece, index) => { board[index] = piece })
  ;[1, 7].forEach((index) => { board[27 + index * 1] = '炮'; board[62 + index * 1] = '炮' })
  ;[0, 2, 4, 6, 8].forEach((index) => { board[30 + index] = '兵'; board[59 - index] = '卒' })
  return board
}
function makeRoom(name, game, password, createdBy) {
  const room = { id: randomUUID().slice(0, 8), name, game, passwordHash: password ? digest(password) : '', createdBy, players: [], board: setupBoard(game), turn: 'red', messages: [] }
  rooms.set(room.id, room)
  return room
}
makeRoom('月光棋局', '中国象棋', '', '林深')
makeRoom('安静的围棋桌', '围棋', 'go88', '白石')
makeRoom('周末快棋', '国际象棋', '', 'Knight_7')
makeRoom('五子棋练习场', '五子棋', '', '棋友')

const pathClear = (board, fromX, fromY, toX, toY, width) => { const stepX = Math.sign(toX - fromX); const stepY = Math.sign(toY - fromY); let x = fromX + stepX; let y = fromY + stepY; while (x !== toX || y !== toY) { if (board[y * width + x]) return false; x += stepX; y += stepY } return true }
function validChess(board, from, to, turn) {
  const fx = from % 8, fy = Math.floor(from / 8), tx = to % 8, ty = Math.floor(to / 8), piece = board[from]
  if (!piece || (turn === 'red' && piece !== piece.toUpperCase()) || (turn === 'black' && piece !== piece.toLowerCase())) return false
  const dx = tx - fx, dy = ty - fy, ax = Math.abs(dx), ay = Math.abs(dy), target = board[to]
  if (target && ((turn === 'red' && target === target.toUpperCase()) || (turn === 'black' && target === target.toLowerCase()))) return false
  if (piece.toLowerCase() === 'p') return turn === 'red' ? (dy === -1 && ax === 0) || (fy === 6 && dy === -2 && ax === 0 && !target && !board[from - 8]) || (dy === -1 && ax === 1 && target) : (dy === 1 && ax === 0) || (fy === 1 && dy === 2 && ax === 0 && !target && !board[from + 8]) || (dy === 1 && ax === 1 && target)
  if (piece.toLowerCase() === 'n') return (ax === 1 && ay === 2) || (ax === 2 && ay === 1)
  if (piece.toLowerCase() === 'k') return ax <= 1 && ay <= 1 && (ax + ay > 0)
  if (piece.toLowerCase() === 'r') return (dx === 0 || dy === 0) && pathClear(board, fx, fy, tx, ty, 8)
  if (piece.toLowerCase() === 'b') return ax === ay && pathClear(board, fx, fy, tx, ty, 8)
  return (ax === ay || dx === 0 || dy === 0) && pathClear(board, fx, fy, tx, ty, 8)
}
function validXiangqi(board, from, to, turn) {
  const fx = from % 9, fy = Math.floor(from / 9), tx = to % 9, ty = Math.floor(to / 9), piece = board[from]
  if (!piece || (turn === 'red' && !redXiangqi.has(piece)) || (turn === 'black' && !blackXiangqi.has(piece))) return false
  const dx = tx - fx, dy = ty - fy, ax = Math.abs(dx), ay = Math.abs(dy), target = board[to]
  if (target && (turn === 'red' ? redXiangqi.has(target) : blackXiangqi.has(target))) return false
  const kind = xiangqiKind[piece]
  if (kind === '兵') return turn === 'red' ? (dy === -1 && ax === 0) || (fy <= 4 && dy === 0 && ax === 1) : (dy === 1 && ax === 0) || (fy >= 5 && dy === 0 && ax === 1)
  if (kind === '马') return (ax === 1 && ay === 2) || (ax === 2 && ay === 1)
  if (kind === '车') return (dx === 0 || dy === 0) && pathClear(board, fx, fy, tx, ty, 9)
  if (kind === '炮') { const between = []; const sx = Math.sign(dx), sy = Math.sign(dy); let x = fx + sx, y = fy + sy; while (x !== tx || y !== ty) { between.push(board[y * 9 + x]); x += sx; y += sy }; return (dx === 0 || dy === 0) && (target ? between.filter(Boolean).length === 1 : between.filter(Boolean).length === 0) }
  if (kind === '将') return ax + ay === 1 && tx >= 3 && tx <= 5 && (turn === 'red' ? ty >= 7 : ty <= 2)
  if (kind === '象') return ax === 2 && ay === 2 && !board[(fy + dy / 2) * 9 + fx + dx / 2] && (turn === 'red' ? ty >= 5 : ty <= 4)
  if (kind === '士') return ax === 1 && ay === 1 && tx >= 3 && tx <= 5 && (turn === 'red' ? ty >= 7 : ty <= 2)
  return false
}
const neighbors = (index, size) => { const x = index % size, y = Math.floor(index / size); return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size).map(([nx, ny]) => ny * size + nx) }
function group(board, start, size) { const color = board[start], found = new Set([start]), stack = [start]; while (stack.length) for (const next of neighbors(stack.pop(), size)) if (board[next] === color && !found.has(next)) { found.add(next); stack.push(next) }; return found }
function hasLiberty(board, stones, size) { return [...stones].some((stone) => neighbors(stone, size).some((next) => !board[next])) }
function validGo(room, index) { return index >= 0 && index < 361 && !room.board[index] }
function applyGo(room, index) { if (!validGo(room, index)) return false; const color = room.turn === 'red' ? 'black' : 'white'; room.board[index] = color; for (const next of neighbors(index, 19)) if (room.board[next] && room.board[next] !== color) { const enemy = group(room.board, next, 19); if (!hasLiberty(room.board, enemy, 19)) for (const stone of enemy) room.board[stone] = null }; const own = group(room.board, index, 19); if (!hasLiberty(room.board, own, 19)) { room.board[index] = null; return false }; room.turn = room.turn === 'red' ? 'black' : 'red'; return true }
function applyGomoku(room, index) { const size = 15; if (index < 0 || index >= size * size || room.board[index]) return false; const color = room.turn === 'red' ? 'black' : 'white'; room.board[index] = color; const x = index % size, y = Math.floor(index / size); const directions = [[1, 0], [0, 1], [1, 1], [1, -1]]; room.winner = directions.some(([dx, dy]) => { let count = 1; for (const sign of [-1, 1]) { let nx = x + dx * sign, ny = y + dy * sign; while (nx >= 0 && nx < size && ny >= 0 && ny < size && room.board[ny * size + nx] === color) { count += 1; nx += dx * sign; ny += dy * sign } } return count >= 5 }) ? room.turn : ''; room.turn = room.turn === 'red' ? 'black' : 'red'; return true }
function applyMove(room, from, to) {
  if (room.game === '围棋') return applyGo(room, to)
  if (room.game === '五子棋') return applyGomoku(room, to)
  const valid = room.game === '国际象棋' ? validChess(room.board, from, to, room.turn) : validXiangqi(room.board, from, to, room.turn)
  if (!valid) return false
  room.board[to] = room.board[from]; room.board[from] = null; room.turn = room.turn === 'red' ? 'black' : 'red'; return true
}
function roomState(room) { return { room: roomSummary(room), board: room.board, turn: room.turn, messages: room.messages } }
function broadcastRoom(room) { for (const socket of sockets) if (socket.roomId === room.id) send(socket, 'room_state', roomState(room)) }
function broadcastRooms() { const payload = [...rooms.values()].map(roomSummary); for (const socket of sockets) send(socket, 'rooms', { rooms: payload }) }

const distRoot = resolve('dist')
const contentTypes = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.html': 'text/html; charset=utf-8' }
const httpServer = createServer((request, response) => {
  const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname
  if (pathname === '/api/health') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify({ service: 'qi-room', status: 'online' })); return }
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '')
  const candidate = resolve(join(distRoot, requested))
  const filePath = candidate.startsWith(distRoot) && existsSync(candidate) ? candidate : join(distRoot, 'index.html')
  if (!existsSync(filePath)) { response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }); response.end('Run npm run build before starting the server.'); return }
  response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] || 'application/octet-stream' })
  response.end(readFileSync(filePath))
})
const wss = new WebSocketServer({ server: httpServer })
wss.on('connection', (socket) => {
  sockets.add(socket)
  send(socket, 'hello', { message: '棋间服务器已连接' })
  socket.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString())
      if (message.type === 'auth') {
        const username = String(message.username || '').trim().slice(0, 20), password = String(message.password || '')
        if (!/^[\u4e00-\u9fa5a-zA-Z0-9_-]{2,20}$/.test(username) || password.length < 4) return send(socket, 'error', { message: '用户名至少 2 位，密码至少 4 位' })
        const existing = users.get(username)
        if (existing && existing.passwordHash !== digest(password)) return send(socket, 'error', { message: '用户名或密码错误' })
        if (!existing) users.set(username, { passwordHash: digest(password) })
        socket.sessionToken = randomUUID(); sessions.set(socket.sessionToken, username); socket.username = username
        send(socket, 'auth_ok', { token: socket.sessionToken, username }); send(socket, 'rooms', { rooms: [...rooms.values()].map(roomSummary) }); return
      }
      const username = userFor(socket)
      if (!username) return send(socket, 'error', { message: '请先登录' })
      if (message.type === 'create_room') { const room = makeRoom(String(message.name || '无名棋局').slice(0, 30), message.game, String(message.password || ''), username); room.players.push(username); socket.roomId = room.id; send(socket, 'room_state', roomState(room)); broadcastRooms(); return }
      if (message.type === 'join_room') { const room = rooms.get(message.roomId); if (!room) return send(socket, 'error', { message: '房间不存在' }); if (room.passwordHash && room.passwordHash !== digest(String(message.password || ''))) return send(socket, 'error', { message: '房间暗号错误' }); if (!room.players.includes(username)) room.players.push(username); socket.roomId = room.id; send(socket, 'room_state', roomState(room)); broadcastRoom(room); broadcastRooms(); return }
      if (message.type === 'leave_room') { socket.roomId = null; return }
      if (message.type === 'chat') { const room = rooms.get(socket.roomId); if (!room || !String(message.text || '').trim()) return; const chat = { id: Date.now(), name: username, text: String(message.text).slice(0, 300), time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }; room.messages.push(chat); room.messages = room.messages.slice(-80); broadcastRoom(room); return }
      if (message.type === 'move') { const room = rooms.get(socket.roomId); if (!room || !room.players.includes(username)) return; const playerIndex = room.players.indexOf(username); const expected = playerIndex === 0 ? 'red' : 'black'; if (room.turn !== expected || !applyMove(room, Number(message.from), Number(message.to))) return send(socket, 'error', { message: '这一步不符合当前棋局规则' }); broadcastRoom(room) }
    } catch { send(socket, 'error', { message: '请求格式无效' }) }
  })
  socket.on('close', () => { sockets.delete(socket); if (socket.roomId) { const room = rooms.get(socket.roomId); if (room) { room.players = room.players.filter((player) => player !== socket.username); broadcastRoom(room); broadcastRooms() } } sessions.delete(socket.sessionToken) })
})
httpServer.listen(port, '0.0.0.0', () => console.log(`棋间 WebSocket server listening on :${port}`))
