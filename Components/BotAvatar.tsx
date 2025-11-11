import React from 'react'
import { Avatar, AvatarImage } from './ui/avatar'

export default function BotAvatar({src} : {src : string}) {
  return (
    <Avatar>
      <AvatarImage src={src} />
    </Avatar>
  )
}
