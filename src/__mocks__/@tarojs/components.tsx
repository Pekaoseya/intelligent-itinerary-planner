/**
 * Taro Components Mock
 */

import React from 'react'

export const View = ({ children, className, style, onClick }: any) => (
  React.createElement('div', { className, style, onClick, 'data-testid': 'view' }, children)
)

export const Text = ({ children, className, style }: any) => (
  React.createElement('span', { className, style, 'data-testid': 'text' }, children)
)

export const ScrollView = ({ children, className, style }: any) => (
  React.createElement('div', { className, style, 'data-testid': 'scroll-view' }, children)
)

export const Swiper = ({ children, className, style }: any) => (
  React.createElement('div', { className, style, 'data-testid': 'swiper' }, children)
)

export const SwiperItem = ({ children }: any) => (
  React.createElement('div', { 'data-testid': 'swiper-item' }, children)
)

export const Map = ({ className, style }: any) => (
  React.createElement('div', { className, style, 'data-testid': 'map' })
)

export const Input = ({ className, style, placeholder, value, onInput }: any) => (
  React.createElement('input', { className, style, placeholder, value, onChange: onInput, 'data-testid': 'input' })
)

export const Button = ({ children, className, style, onClick, size, type }: any) => (
  React.createElement('button', { className, style, onClick, 'data-testid': 'button', 'data-size': size, 'data-type': type }, children)
)

export const Image = ({ src, className, style, mode }: any) => (
  React.createElement('img', { src, className, style, 'data-testid': 'image', 'data-mode': mode })
)
