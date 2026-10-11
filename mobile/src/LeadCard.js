import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export default function LeadCard({ lead }) {
  const flash = useRef(new Animated.Value(lead.fresh ? 1 : 0)).current;
  const displayedFields = Object.entries(lead.fields || {}).filter(
    ([name]) =>
      !['email', 'first_name', 'full_name', 'last_name', 'phone', 'phone_number'].includes(
        name.toLowerCase()
      )
  );

  useEffect(() => {
    if (lead.fresh) {
      Animated.timing(flash, { toValue: 0, duration: 3500, useNativeDriver: false }).start();
    }
  }, [lead.fresh, flash]);

  const backgroundColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ffffff', '#d7f5dd'],
  });

  return (
    <Animated.View style={[styles.card, { backgroundColor }]}>
      <View style={styles.row}>
        <Text style={styles.name}>{lead.name}</Text>
        {lead.fresh && <Text style={styles.badge}>NEW</Text>}
      </View>
      {lead.email && <Text style={styles.line}>✉️  {lead.email}</Text>}
      {lead.phone && <Text style={styles.line}>📞  {lead.phone}</Text>}
      {displayedFields.map(([name, value]) => (
        <Text key={name} style={styles.line}>
          {name.replace(/_+/g, ' ').trim().replace(/\b\w/g, (letter) => letter.toUpperCase())}: {value}
        </Text>
      ))}
      <Text style={styles.meta}>
        Lead {lead.id} · Form {lead.formId || '-'} · {new Date(lead.receivedAt).toLocaleTimeString()}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 17, fontWeight: '700', color: '#111' },
  badge: {
    backgroundColor: '#1a9e3f',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  line: { marginTop: 4, color: '#333' },
  meta: { marginTop: 8, fontSize: 11, color: '#888' },
});
