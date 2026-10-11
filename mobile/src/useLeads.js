import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVER_URL, CLIENT_TOKEN } from './config';

export function useLeads() {
  const [leads, setLeads] = useState([]);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      auth: { token: CLIENT_TOKEN },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('error'));

    socket.on('leads:snapshot', (list) =>
      setLeads(list.map((l) => ({ ...l, fresh: false })))
    );

    socket.on('lead:new', (lead) =>
      setLeads((prev) =>
        prev.some((l) => l.id === lead.id) ? prev : [{ ...lead, fresh: true }, ...prev]
      )
    );

    return () => socket.disconnect();
  }, []);

  return { leads, status };
}
