import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Crown, Gamepad2, KeyRound, MessageCircle, Plus, Send, Shield, Swords, Users, X } from 'lucide-react'
import './App.css'

type GameType = '国际象棋' | '中国象棋' | '围棋' | '五子棋'
type Room = { id: string; name: string; game: GameType; players: number; maxPlayers: number; password: boolean; status: '进行中' | '等待中'; createdBy: string; winner?: string }
type ChatMessage = { id: number; name: string; text: string; time: string; self?: boolean }
type ServerMessage = { type: string; rooms?: Room[]; room?: Room; board?: (string | null)[]; turn?: string; messages?: ChatMessage[]; username?: string; message?: string }

const gameMeta: Record<GameType, { tag: string; icon: string }> = { 中国象棋: { tag: 'CN', icon: '将' }, 国际象棋: { tag: 'CH', icon: '♞' }, 围棋: { tag: 'GO', icon: '碁' }, 五子棋: { tag: 'GM', icon: '五' } }
const chessPieces: Record<string, string> = { r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔', P: '♙' }
const xiangqiPieces: Record<string, string> = { 車: '車', 馬: '馬', 相: '相', 士: '仕', 帥: '帥', 炮: '炮', 兵: '兵', 车: '车', 马: '马', 象: '象', 将: '将', 卒: '卒' }

function App() {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const [username, setUsername] = useState(localStorage.getItem('qi-user') || '')
  const [loginName, setLoginName] = useState(localStorage.getItem('qi-user') || '')
  const [loginPassword, setLoginPassword] = useState('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [activeRoom, setActiveRoom] = useState<Room | null>(null)
  const [board, setBoard] = useState<(string | null)[]>([])
  const [turn, setTurn] = useState('red')
  const [game, setGame] = useState<GameType>('中国象棋')
  const [showCreate, setShowCreate] = useState(false)
  const [joinRoom, setJoinRoom] = useState<Room | null>(null)
  const [roomPassword, setRoomPassword] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomPassword, setNewRoomPassword] = useState('')
  const [chatText, setChatText] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const send = (payload: Record<string, unknown>) => { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload)) }
  useEffect(() => {
    const localEndpoint = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
    const endpoint = import.meta.env.VITE_WS_URL || localEndpoint
    const connection = new WebSocket(endpoint)
    connection.onopen = () => { setConnected(true); const savedName = localStorage.getItem('qi-user'); const savedPassword = localStorage.getItem('qi-pass'); if (savedName && savedPassword) connection.send(JSON.stringify({ type: 'auth', username: savedName, password: savedPassword })) }
    connection.onclose = () => setConnected(false)
    connection.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage
      if (message.type === 'auth_ok') { setUsername(message.username || ''); localStorage.setItem('qi-user', message.username || '') }
      if (message.type === 'rooms') setRooms(message.rooms || [])
      if (message.type === 'room_state' && message.room) { setActiveRoom(message.room); setGame(message.room.game); setBoard(message.board || []); setTurn(message.turn || 'red'); setMessages(message.messages || []); setSelected(null) }
      if (message.type === 'error') setError(message.message || '操作失败')
    }
    setSocket(connection)
    return () => connection.close()
  }, [])

  const currentGame = activeRoom?.game || game
  const boardCells = useMemo(() => Array.from({ length: currentGame === '围棋' ? 361 : currentGame === '五子棋' ? 225 : currentGame === '国际象棋' ? 64 : 90 }, (_, index) => index), [currentGame])
  const isPlacementGame = currentGame === '围棋' || currentGame === '五子棋'
  const submitLogin = () => { setError(''); localStorage.setItem('qi-pass', loginPassword); send({ type: 'auth', username: loginName, password: loginPassword }) }
  const createRoom = () => { send({ type: 'create_room', name: newRoomName || '无名棋局', game, password: newRoomPassword }); setShowCreate(false); setNewRoomName(''); setNewRoomPassword('') }
  const selectRoom = (room: Room) => room.password ? setJoinRoom(room) : send({ type: 'join_room', roomId: room.id })
  const enterRoom = () => { if (joinRoom) send({ type: 'join_room', roomId: joinRoom.id, password: roomPassword }); setJoinRoom(null); setRoomPassword('') }
  const sendChat = () => { if (!chatText.trim()) return; send({ type: 'chat', text: chatText.trim() }); setChatText('') }
  const playSquare = (index: number) => { if (!activeRoom || activeRoom.winner) return; if (isPlacementGame) send({ type: 'move', roomId: activeRoom.id, from: -1, to: index }); else if (selected === null) setSelected(index); else { send({ type: 'move', roomId: activeRoom.id, from: selected, to: index }); setSelected(null) } }
  const displayedPiece = (piece: string | null) => currentGame === '国际象棋' ? (piece ? chessPieces[piece] : null) : currentGame === '中国象棋' ? (piece ? xiangqiPieces[piece] : null) : null

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark"><Swords size={19} /></div><span>棋间</span><em>ONLINE CLUB</em></div><div className="connection"><span className={`live-dot ${connected ? '' : 'offline'}`} /> {connected ? '服务器在线' : '连接中'} <span className="divider" /><span className="avatar">{username.slice(0, 1).toUpperCase() || '?'}</span> {username || '访客'}</div></header>
    <main className="workspace">
      <aside className="sidebar"><div className="side-title"><div><span className="eyebrow">PLAYGROUND</span><h1>棋局大厅</h1></div><button className="icon-button" title="新建房间" onClick={() => setShowCreate(true)}><Plus size={19} /></button></div><div className="game-tabs">{(['全部', '国际象棋', '中国象棋', '围棋', '五子棋'] as const).map((item) => <button className={currentGame === item ? 'active' : ''} key={item} onClick={() => item !== '全部' && setGame(item)}>{item}</button>)}</div><div className="room-list">{rooms.map((room) => <button className={`room-item ${room.id === activeRoom?.id ? 'selected' : ''}`} key={room.id} onClick={() => selectRoom(room)}><div className="room-icon">{gameMeta[room.game].icon}</div><div className="room-copy"><strong>{room.name}</strong><span>{gameMeta[room.game].tag} · {room.players}/{room.maxPlayers} 人</span></div><span className={`room-status ${room.status === '进行中' ? 'playing' : ''}`}><i />{room.status}</span></button>)}</div><button className="create-room" onClick={() => setShowCreate(true)}><Plus size={16} /> 创建新房间</button><div className="sidebar-foot"><Shield size={15} /> 密码只在服务端校验<br /><span>四种棋局实时同步已开启</span></div></aside>
      <section className="game-area"><div className="game-head"><div><span className="eyebrow">ROOM / {activeRoom?.id?.toUpperCase() || '大厅'}</span><h2>{activeRoom?.name || '选择一个房间'} {activeRoom && <span className="private-chip"><KeyRound size={12} /> {activeRoom.password ? '私密' : '公开'}</span>}</h2><p><span className="live-dot" /> {activeRoom?.winner ? `${activeRoom.winner === 'red' ? '红方' : '黑方'} 获胜` : `${activeRoom?.status || '等待加入'} · ${activeRoom?.createdBy || '服务器'}`}</p></div><div className="head-actions">{activeRoom && <button className="outline-button" onClick={() => navigator.clipboard?.writeText(activeRoom.id)}><Copy size={15} /> 房间码 <b>{activeRoom.id.toUpperCase()}</b></button>}<button className="leave-button" onClick={() => { send({ type: 'leave_room' }); setActiveRoom(null) }}>退出房间</button></div></div><div className={`board-wrap ${currentGame === '围棋' ? 'go-wrap' : ''} ${currentGame === '五子棋' ? 'gomoku-wrap' : ''}`}><div className="turn-label"><span className="turn-dot" /> {activeRoom?.winner ? '棋局结束' : `轮到 ${turn === 'red' ? '红方' : '黑方'} · 服务端裁决`}</div><div className={`board ${currentGame === '围棋' ? 'go-board' : currentGame === '五子棋' ? 'gomoku-board' : currentGame === '国际象棋' ? 'chess-board' : 'xiangqi-board'}`}>{boardCells.map((_, index) => <button className={`square ${selected === index ? 'square-selected' : ''}`} key={index} onClick={() => playSquare(index)}>{isPlacementGame && board[index] && <span className={`stone ${board[index] === 'white' ? 'white' : ''}`} />}{!isPlacementGame && displayedPiece(board[index]) && <span className={`piece ${currentGame === '中国象棋' ? 'cn-piece' : ''}`}>{displayedPiece(board[index])}</span>}</button>)}</div></div><div className="game-footer"><div className="player"><div className="player-avatar red">{activeRoom?.createdBy?.slice(0, 1) || '红'}</div><div><strong>{activeRoom?.createdBy || '红方'}</strong><span>红方 · 服务端</span></div><Crown size={16} /></div><div className="move-count">{activeRoom ? '实时对战' : '等待入场'} <span>·</span> {currentGame}</div><div className="player opponent"><div><strong>{activeRoom?.players === 2 ? username : '等待对手'}</strong><span>黑方 · 在线</span></div><div className="player-avatar dark">{activeRoom?.players === 2 ? username.slice(0, 1).toUpperCase() : '?'}</div></div></div></section>
      <aside className="chat-panel"><div className="chat-head"><div><span className="eyebrow">ROOM CHAT</span><h2><MessageCircle size={18} /> 房间聊天</h2></div><span className="member-count"><Users size={14} /> {activeRoom?.players || 0}</span></div><div className="chat-messages">{messages.map((message) => <div className={`message ${message.name === username ? 'self' : ''}`} key={message.id}><div className="message-meta"><strong>{message.name}</strong><span>{message.time}</span></div><p>{message.text}</p></div>)}</div><div className="chat-input"><input value={chatText} onChange={(event) => setChatText(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendChat()} placeholder="说点什么..." /><button title="发送" onClick={sendChat}><Send size={16} /></button></div><div className="room-info"><span className="eyebrow">ROOM DETAILS</span><div className="detail-row"><span>游戏</span><strong>{gameMeta[currentGame].icon} {currentGame}</strong></div><div className="detail-row"><span>房间状态</span><strong className="green">● {activeRoom?.winner ? '已结束' : activeRoom?.status || '未加入'}</strong></div><div className="detail-row"><span>裁决方式</span><strong>服务端规则</strong></div></div></aside>
    </main>
    {!username && <div className="modal-backdrop"><div className="modal small"><span className="eyebrow">WELCOME TO QIJIAN</span><h2>登录棋间</h2><p>使用同一账号即可从任何设备进入房间。首次登录会自动注册。</p><label>用户名<input autoFocus value={loginName} onChange={(event) => setLoginName(event.target.value)} placeholder="2-20 位字母、数字或中文" /></label><label>密码<input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && submitLogin()} placeholder="至少 4 位" /></label><button className="primary-button" onClick={submitLogin}><KeyRound size={17} /> 登录 / 注册</button></div></div>}
    {showCreate && <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={() => setShowCreate(false)}><X size={18} /></button><span className="eyebrow">NEW ROOM</span><h2>创建一个棋局</h2><p>房间会立即出现在所有已连接设备的大厅中。</p><label>房间名称<input autoFocus value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} placeholder="例如：周五晚间快棋" /></label><label>选择棋类<div className="choice-grid">{(['中国象棋', '国际象棋', '围棋', '五子棋'] as GameType[]).map((item) => <button className={game === item ? 'chosen' : ''} key={item} onClick={() => setGame(item)}>{gameMeta[item].icon}<span>{item}</span>{game === item && <Check size={14} />}</button>)}</div></label><label>暗号密码 <small>可选</small><input type="password" value={newRoomPassword} onChange={(event) => setNewRoomPassword(event.target.value)} placeholder="留空则公开" /></label><button className="primary-button" onClick={createRoom}><Gamepad2 size={17} /> 创建房间</button></div></div>}
    {joinRoom && <div className="modal-backdrop"><div className="modal small"><button className="modal-close" onClick={() => setJoinRoom(null)}><X size={18} /></button><span className="eyebrow">PRIVATE ROOM</span><h2>输入房间暗号</h2><p>「{joinRoom.name}」的暗号由服务端验证。</p><label>暗号密码<input autoFocus type="password" value={roomPassword} onChange={(event) => setRoomPassword(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && enterRoom()} placeholder="输入暗号" /></label><button className="primary-button" onClick={enterRoom}><KeyRound size={17} /> 验证并加入</button></div></div>}
    {error && <button className="error-toast" onClick={() => setError('')}>{error} ×</button>}
  </div>
}

export default App
