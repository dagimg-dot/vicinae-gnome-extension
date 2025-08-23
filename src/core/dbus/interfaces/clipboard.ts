export const CLIPBOARD_DBUS_IFACE = `
<node>
   <interface name="org.gnome.Shell.Extensions.Clipboard">
      <method name="ListenToClipboardChanges">
      </method>
      <method name="TriggerClipboardChange">
         <arg type="s" direction="in" name="content" />
         <arg type="s" direction="in" name="source" />
      </method>
      <method name="GetCurrentContent">
         <arg type="s" direction="out" name="content" />
      </method>
      <method name="SetContent">
         <arg type="s" direction="in" name="content" />
      </method>
      <signal name="ClipboardChanged">
         <arg type="s" name="content" />
         <arg type="u" name="timestamp" />
         <arg type="s" name="source" />
      </signal>
   </interface>
</node>`;
