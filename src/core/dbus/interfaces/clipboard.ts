export const CLIPBOARD_DBUS_IFACE = `
<node>
   <interface name="org.gnome.Shell.Extensions.Clipboard">
      <method name="ListenToClipboardChanges">
      </method>
      <method name="GetClipboardMimeTypes">
         <arg type="as" direction="out" name="mimeTypes" />
      </method>
      <method name="StopListening">
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
         <arg type="t" name="timestamp" />
         <arg type="s" name="source" />
         <arg type="s" name="mimeType" />
         <arg type="s" name="contentType" />
         <arg type="s" name="contentHash" />
         <arg type="t" name="size" />
         <arg type="s" name="sourceApp" />
      </signal>
   </interface>
</node>`;
