import React from 'react'
import useThemeStore from '@/stores/themeSlice'
import {SettingContainer} from '..'
import NpxSearch from './NpxSearch'

interface NpxPackagesTabProps {
    isActive?: boolean
}

const NpxPackagesTab: React.FC<NpxPackagesTabProps> = ({isActive = false}) => {
    const {isDarkMode} = useThemeStore()

    return (
        <SettingContainer theme={isDarkMode ? 'dark' : 'light'}>
            <NpxSearch isActive={isActive} />
        </SettingContainer>
    )
}

export default NpxPackagesTab

