import React from 'react';
import { FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLeads } from './src/useLeads';
import LeadCard from './src/LeadCard';
import { SERVER_URL } from './src/config';

const STATUS = {
  connecting: { color: '#e0a800', label: 'Connecting…' },
  connected: { color: '#1a9e3f', label: 'Live' },
  disconnected: { color: '#d9534f', label: 'Disconnected – retrying' },
  error: { color: '#d9534f', label: 'Cannot reach server – retrying' },
};

export default function App() {
  const { leads, status } = useLeads();
  const s = STATUS[status];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Live Leads ({leads.length})</Text>
        <View style={styles.pill}>
          <View style={[styles.dot, { backgroundColor: s.color }]} />
          <Text style={styles.pillText}>{s.label}</Text>
        </View>
      </View>
      <Text style={styles.server}>{SERVER_URL}</Text>

      <FlatList
        data={leads}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => <LeadCard lead={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Waiting for leads…{'\n'}Submit one from Meta's Lead Ads Testing Tool.
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f3f5f9', paddingTop: 30 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: { fontSize: 22, fontWeight: '800' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 6 },
  pillText: { fontSize: 12, fontWeight: '600' },
  server: { paddingHorizontal: 16, paddingTop: 4, fontSize: 11, color: '#888' },
  list: { padding: 16 },
  empty: { textAlign: 'center', marginTop: 80, color: '#777', lineHeight: 22 },
});
