export interface MidiPortDescriptor {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input' | 'output';
}

export interface MidiPortSelection {
  inputId?: string;
  outputId?: string;
}
