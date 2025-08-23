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
   </interface>
</node>`;
