import React, {FC} from "react";
import {SettingContainer} from "..";
import useThemeStore from "@/stores/themeSlice";
import InstallNpxUv from "./InstallNpxUv";
import NpxSearch from "./NpxSearch";

const NpxSettings: FC = () => {
  const { isDarkMode } = useThemeStore();

  return (
    <SettingContainer theme={isDarkMode ? "dark" : "light"}>
      <InstallNpxUv />
      <NpxSearch />
    </SettingContainer>
  );
};

export default NpxSettings;


