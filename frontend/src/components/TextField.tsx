import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from "../infrastructure/reactNative";

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "phone-pad";
  textContentType?:
    | "name"
    | "emailAddress"
    | "password"
    | "telephoneNumber"
    | "oneTimeCode";
  helperText?: string | null;
  autoFocus?: boolean;
  maxLength?: number;
};

const TextField = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = "none",
  keyboardType = "default",
  textContentType,
  helperText,
  autoFocus,
  maxLength,
}: TextFieldProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA69C"
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        textContentType={textContentType}
        autoFocus={autoFocus}
        maxLength={maxLength}
        style={styles.input}
      />
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: "#556055",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7DCD2",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1C221B",
  },
  helper: {
    marginTop: 6,
    color: "#556055",
    fontSize: 12,
  },
});

export default TextField;
