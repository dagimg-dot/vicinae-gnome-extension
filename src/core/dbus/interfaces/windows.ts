export const WINDOWS_DBUS_IFACE = `
<node>
   <interface name="org.gnome.Shell.Extensions.Windows">
      <method name="List">
         <arg type="s" direction="out" name="win" />
      </method>
      <method name="Details">
         <arg type="u" direction="in" name="winid" />
         <arg type="s" direction="out" name="win" />
      </method>
      <method name="GetTitle">
         <arg type="u" direction="in" name="winid" />
         <arg type="s" direction="out" name="win" />
      </method>
      <method name="GetFrameRect">
         <arg type="u" direction="in" name="winid" />
         <arg type="s" direction="out" name="frameRect" />
      </method>
      <method name="GetFrameBounds">
         <arg type="u" direction="in" name="winid" />
         <arg type="s" direction="out" name="frameBounds" />
      </method>
      <method name="MoveToWorkspace">
         <arg type="u" direction="in" name="winid" />
         <arg type="u" direction="in" name="workspaceNum" />
      </method>
      <method name="MoveResize">
         <arg type="u" direction="in" name="winid" />
         <arg type="i" direction="in" name="x" />
         <arg type="i" direction="in" name="y" />
         <arg type="u" direction="in" name="width" />
         <arg type="u" direction="in" name="height" />
      </method>
      <method name="Resize">
         <arg type="u" direction="in" name="winid" />
         <arg type="u" direction="in" name="width" />
         <arg type="u" direction="in" name="height" />
      </method>
      <method name="Move">
         <arg type="u" direction="in" name="winid" />
         <arg type="i" direction="in" name="x" />
         <arg type="i" direction="in" name="y" />
      </method>
      <method name="Maximize">
         <arg type="u" direction="in" name="winid" />
      </method>
      <method name="Minimize">
         <arg type="u" direction="in" name="winid" />
      </method>
      <method name="Unmaximize">
         <arg type="u" direction="in" name="winid" />
      </method>
      <method name="Unminimize">
         <arg type="u" direction="in" name="winid" />
      </method>
      <method name="Activate">
         <arg type="u" direction="in" name="winid" />
      </method>
      <method name="Close">
         <arg type="u" direction="in" name="winid" />
      </method>
      <method name="ListWorkspaces">
         <arg type="s" direction="out" name="workspaces" />
      </method>
      <method name="GetActiveWorkspace">
         <arg type="s" direction="out" name="workspace" />
      </method>
      <method name="GetWorkspaceWindows">
         <arg type="u" direction="in" name="workspaceIndex" />
         <arg type="s" direction="out" name="windows" />
      </method>
      <signal name="openwindow">
         <arg type="s" name="windowAddress" />
         <arg type="s" name="workspaceName" />
         <arg type="s" name="wmClass" />
         <arg type="s" name="title" />
      </signal>
      <signal name="closewindow">
         <arg type="s" name="windowAddress" />
      </signal>
      <signal name="focuswindow">
         <arg type="s" name="windowAddress" />
      </signal>
      <signal name="movewindow">
         <arg type="s" name="windowAddress" />
         <arg type="i" name="x" />
         <arg type="i" name="y" />
         <arg type="u" name="width" />
         <arg type="u" name="height" />
      </signal>
      <signal name="statewindow">
         <arg type="s" name="windowAddress" />
         <arg type="s" name="state" />
      </signal>
      <signal name="workspacechanged">
         <arg type="s" name="workspaceId" />
      </signal>
      <signal name="monitorlayoutchanged">
      </signal>
   </interface>
</node>`;
