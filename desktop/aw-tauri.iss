; Inno Setup script for SeeSeeYou Desktop
;
; This is separate from activitywatch-setup.iss (aw-qt) to avoid
; installation collisions. Uses a different AppId, install directory,
; and display name.

#define MyAppName "SeeSeeYou"
#define MyAppVersion "0.1.1"
#define MyAppPublisher "SeeSeeYou"
#define MyAppURL "https://watch.sding.me/"
#define MyAppExeName "aw-tauri.exe"
#define RootDir "..\.."
#define DistDir "..\..\dist"

#pragma verboselevel 9

[Setup]
; IMPORTANT: Different AppId from aw-qt to allow side-by-side installation
AppId={{5D7F7CA1-83D2-4A4F-90E7-579A14C55017}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL="https://github.com/shuaizhangbook/seeseeyou/issues"
AppUpdatesURL="https://github.com/shuaizhangbook/seeseeyou/releases"
DefaultDirName={autopf}\SeeSeeYou
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputDir={#DistDir}
OutputBaseFilename=activitywatch-setup
SetupIconFile="{#RootDir}\aw-tauri\src-tauri\icons\icon.ico"
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "StartMenuEntry" ; Description: "Start SeeSeeYou when Windows starts"; GroupDescription: "Windows Startup"; MinVersion: 4,4;

[Files]
Source: "{#DistDir}\activitywatch\aw-tauri.exe"; DestDir: "{app}\aw-tauri"; Flags: ignoreversion
Source: "{#DistDir}\activitywatch\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: StartMenuEntry;

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
