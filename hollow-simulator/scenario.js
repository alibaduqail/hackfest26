// Fictional test inputs, not real infrastructure measurements.
export const scenario = {
  name: 'District 07 · The Sump', endMinute: 12,
  rooms: [
    { id: 'surface', name: 'Surface gate', level: 'Surface', depends: 'A sealed entrance. Surface machines still move beyond the shutters.' },
    { id: 'clinic', name: 'Upper clinic', level: 'Upper', depends: '24 households rely on its independent upper-level feeder.' },
    { id: 'depot', name: 'Supply depot', level: 'Upper', depends: 'Dispatches the district cart and its food and medicine crates.' },
    { id: 'farm', name: 'Lamp farm', level: 'Middle', depends: '18 households depend on its communal harvest.' },
    { id: 'lift', name: 'Lift landing', level: 'Middle', depends: 'The cart travels between the depot and the lower passage here.' },
    { id: 'tunnel', name: 'Sump passage', level: 'Lower', depends: 'The only depot route for 12 lower households. Flooding closes it.' },
    { id: 'homes', name: 'Lower homes', level: 'Lower', depends: '12 households depend on the passage, cooling fan, and drainage pump.' },
    { id: 'deep-fan', name: 'Cooling fan', level: 'Lower', depends: 'Cools the lower homes when assigned backup power.' },
    { id: 'deep-pump', name: 'Drainage pump', level: 'Lower', depends: 'Drains the passage when assigned backup power.' }
  ],
  households: [{ id: 'upper', level: 'Upper', count: 24 }, { id: 'middle', level: 'Middle', count: 18 }, { id: 'lower', level: 'Lower', count: 12, route: ['depot', 'lift', 'tunnel', 'homes'] }],
  connections: [['depot', 'lift'], ['lift', 'tunnel'], ['tunnel', 'homes']],
  machines: { batteryMinutes: 20, floodRise: 1, pumpDrain: 2, closeAt: 4, reopenBelow: 4 },
  cart: { travelMinutes: 4, crates: 3 },
  failures: [{ minute: 1, id: 'lower-feeder', description: 'Lower feeder trips; upper clinic remains powered.' }]
};
