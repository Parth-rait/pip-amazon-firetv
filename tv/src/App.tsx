import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {SHOW_DIAGNOSTICS} from './config';
import {DiagnosticsScreen} from './screens/DiagnosticsScreen';

export const App = () => {
  if (SHOW_DIAGNOSTICS) return <DiagnosticsScreen />;
  return (
    <View style={styles.root}>
      <Text style={styles.text}>Pip</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1020',
  },
  text: {color: '#FFFFFF', fontSize: 64},
});
