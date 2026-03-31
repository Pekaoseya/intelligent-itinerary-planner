/**
 * Lucide Icons Mock
 */

import React from 'react'

const createIcon = (name: string) => {
  const Icon = ({ size, color, className }: any) => (
    React.createElement('span', {
      'data-testid': `icon-${name.toLowerCase()}`,
      'data-size': size,
      'data-color': color,
      className
    })
  )
  Icon.displayName = name
  return Icon
}

export const Car = createIcon('Car')
export const TrainFront = createIcon('TrainFront')
export const Plane = createIcon('Plane')
export const MapPin = createIcon('MapPin')
export const Calendar = createIcon('Calendar')
export const Check = createIcon('Check')
export const Clock = createIcon('Clock')
export const Settings = createIcon('Settings')
export const TrendingUp = createIcon('TrendingUp')
export const Bell = createIcon('Bell')
export const User = createIcon('User')
export const Plus = createIcon('Plus')
export const X = createIcon('X')
export const Navigation = createIcon('Navigation')
export const Trash2 = createIcon('Trash2')
export const Building2 = createIcon('Building2')
export const Utensils = createIcon('Utensils')
export const Users = createIcon('Users')
export const Phone = createIcon('Phone')
