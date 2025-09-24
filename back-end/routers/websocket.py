# websocket.py
# WebSocket 即時通訊管理

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
import json
import asyncio
from loguru import logger

class ConnectionManager:
    def __init__(self):
        # 用戶ID -> WebSocket 連接的映射
        self.active_connections: Dict[int, WebSocket] = {}
        # 聊天室ID -> 用戶ID列表的映射
        self.room_users: Dict[int, List[int]] = {}
        # 用戶ID -> 用戶資料的映射（包含角色等資訊）
        self.user_data: Dict[int, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: int, user_data: dict = None):
        """建立 WebSocket 連接"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        
        # 儲存用戶資料（包含角色等資訊）
        if user_data:
            self.user_data[user_id] = user_data
        
        logger.info(f"用戶 {user_id} (角色: {user_data.get('role', 'unknown') if user_data else 'unknown'}) 已連接 WebSocket")

    def disconnect(self, user_id: int):
        """斷開 WebSocket 連接"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"用戶 {user_id} 已斷開 WebSocket")
        
        # 從所有聊天室中移除用戶
        for room_id, users in self.room_users.items():
            if user_id in users:
                users.remove(user_id)

    async def join_room(self, user_id: int, room_id: int):
        """加入聊天室"""
        if room_id not in self.room_users:
            self.room_users[room_id] = []
        
        if user_id not in self.room_users[room_id]:
            self.room_users[room_id].append(user_id)
            logger.info(f"用戶 {user_id} 加入聊天室 {room_id}")

    async def leave_room(self, user_id: int, room_id: int):
        """離開聊天室"""
        if room_id in self.room_users and user_id in self.room_users[room_id]:
            self.room_users[room_id].remove(user_id)
            logger.info(f"用戶 {user_id} 離開聊天室 {room_id}")

    async def send_personal_message(self, message: dict, user_id: int):
        """發送個人訊息"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(json.dumps(message))
                return True
            except:
                # 連接已斷開，移除
                self.disconnect(user_id)
                return False
        return False

    async def send_room_message(self, message: dict, room_id: int, exclude_user_id: int = None):
        """發送聊天室訊息給所有成員（除了發送者）"""
        if room_id not in self.room_users:
            return
        
        users_to_notify = self.room_users[room_id].copy()
        if exclude_user_id:
            users_to_notify = [uid for uid in users_to_notify if uid != exclude_user_id]
        
        for user_id in users_to_notify:
            await self.send_personal_message(message, user_id)

    async def broadcast_to_all(self, message: dict):
        """廣播訊息給所有連接的用戶"""
        disconnected_users = []
        
        for user_id, connection in self.active_connections.items():
            try:
                await connection.send_text(json.dumps(message))
            except:
                disconnected_users.append(user_id)
        
        # 清理斷開的連接
        for user_id in disconnected_users:
            self.disconnect(user_id)

    def get_online_users(self) -> List[int]:
        """取得所有在線用戶ID"""
        return list(self.active_connections.keys())

    def get_room_online_users(self, room_id: int) -> List[int]:
        """取得聊天室內的在線用戶"""
        if room_id not in self.room_users:
            return []
        
        room_users = self.room_users[room_id]
        online_users = [uid for uid in room_users if uid in self.active_connections]
        return online_users

# 全局連接管理器實例
manager = ConnectionManager()

class WebSocketService:
    """WebSocket 服務類"""
    
    @staticmethod
    async def handle_message(user_id: int, message_data: dict):
        """處理收到的 WebSocket 訊息"""
        message_type = message_data.get('type')
        
        if message_type == 'join_room':
            room_id = message_data.get('room_id')
            if room_id:
                await manager.join_room(user_id, room_id)
                # 通知聊天室其他成員有新用戶加入
                await manager.send_room_message({
                    'type': 'user_joined',
                    'user_id': user_id,
                    'room_id': room_id
                }, room_id, exclude_user_id=user_id)
        
        elif message_type == 'leave_room':
            room_id = message_data.get('room_id')
            if room_id:
                await manager.leave_room(user_id, room_id)
                # 通知聊天室其他成員有用戶離開
                await manager.send_room_message({
                    'type': 'user_left',
                    'user_id': user_id,
                    'room_id': room_id
                }, room_id, exclude_user_id=user_id)
        
        elif message_type == 'ping':
            # 回應 ping 訊息
            await manager.send_personal_message({
                'type': 'pong',
                'timestamp': message_data.get('timestamp')
            }, user_id)
        
        elif message_type == 'typing':
            # 處理正在輸入狀態
            room_id = message_data.get('room_id')
            if room_id:
                await manager.send_room_message({
                    'type': 'typing',
                    'user_id': user_id,
                    'room_id': room_id,
                    'is_typing': message_data.get('is_typing', False)
                }, room_id, exclude_user_id=user_id)

    @staticmethod
    async def notify_new_message(chat_room_id: int, message: dict, sender_id: int):
        """通知新訊息"""
        await manager.send_room_message({
            'type': 'new_message',
            'chat_room_id': chat_room_id,
            'message': message
        }, chat_room_id, exclude_user_id=sender_id)

    @staticmethod
    async def notify_message_read(chat_room_id: int, message_ids: List[int], reader_id: int):
        """通知訊息已讀"""
        await manager.send_room_message({
            'type': 'messages_read',
            'chat_room_id': chat_room_id,
            'message_ids': message_ids,
            'reader_id': reader_id
        }, chat_room_id, exclude_user_id=reader_id)

    @staticmethod
    def get_connection_manager():
        """取得連接管理器實例"""
        return manager
