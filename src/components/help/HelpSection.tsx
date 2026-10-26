import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  FileEdit,
  Footprints,
  HelpCircle,
  Music,
  Radio,
  Sparkles,
  Users,
} from 'lucide-react-native';

import { COLORS } from '../../constants/theme';

interface HelpSectionProps {
  id: string;
  title: string;
  iconName?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function HelpSection({
  title,
  iconName,
  defaultExpanded = false,
  children,
}: HelpSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const renderIcon = () => {
    const iconProps = { size: 20, color: COLORS.accent };
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles {...iconProps} />;
      case 'FileEdit':
        return <FileEdit {...iconProps} />;
      case 'Music':
        return <Music {...iconProps} />;
      case 'Users':
        return <Users {...iconProps} />;
      case 'Radio':
        return <Radio {...iconProps} />;
      case 'Footprints':
        return <Footprints {...iconProps} />;
      case 'HelpCircle':
      default:
        return <HelpCircle {...iconProps} />;
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(prev => !prev)}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          {iconName && <View style={styles.iconWrapper}>{renderIcon()}</View>}
          <Text style={styles.title}>{title}</Text>
        </View>

        {expanded ? (
          <ChevronUp size={20} color={COLORS.mutedForeground} />
        ) : (
          <ChevronDown size={20} color={COLORS.mutedForeground} />
        )}
      </TouchableOpacity>

      {expanded && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconWrapper: {
    marginRight: 12,
  },
  title: {
    color: COLORS.foreground,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#262626',
  },
});
