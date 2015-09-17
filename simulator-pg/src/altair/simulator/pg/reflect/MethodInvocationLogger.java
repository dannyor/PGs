package altair.simulator.pg.reflect;

import java.io.PrintStream;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.HashSet;
import java.util.Set;

public class MethodInvocationLogger {

	public static <T> T getLoggingInstance(Object impl, Class<T> clazz) {
		return getLoggingInstance(impl, clazz, false);
	}

	@SuppressWarnings("unchecked")
	public static <T> T getLoggingInstance(Object impl, Class<T> clazz, boolean showValues) {
		if (!clazz.isInterface()) {
			throw new IllegalArgumentException();
		}
		if (!clazz.isAssignableFrom(impl.getClass())) {
			throw new IllegalArgumentException();
		}
		InvocHndlr invocationHandler = new InvocHndlr(System.out, impl, showValues);
		return (T) Proxy.newProxyInstance(clazz.getClassLoader(), new Class<?>[] { clazz }, invocationHandler);
	}

	private static class InvocHndlr implements InvocationHandler {
		Object impl;
		boolean showValues;
		PrintStream ps;

		Set<String> filteredMethods = new HashSet<String>();

		public InvocHndlr(PrintStream ps, Object impl, boolean showValues) {
			this.ps = ps;
			this.impl = impl;
			this.showValues = showValues;
			filteredMethods.add("toString");
			filteredMethods.add("equals");
			filteredMethods.add("hashCode");
		}

		@Override
		public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
			Object returnValue = method.invoke(impl, args);
			if (filteredMethods.contains(method.getName())) {
				return returnValue;
			}
			synchronized (ps) {
				ps.print("> ");
				ps.print(impl.getClass().getName());
				ps.print(".");
				ps.print(method.getName());
				ps.print("(");
				if (args != null && showValues) {
					for (int i = 0; i < args.length; i++) {
						if (i > 0) {
							ps.print(",");
						}
						ps.print(args[i]);
					}
				}
				ps.print(")");
				if (returnValue != null && returnValue.toString().contains("MOCK_MEM")) {
					System.out.print("");
				}
				if (showValues) {
					ps.print(" --> ");
					ps.print(returnValue);
				}
				ps.println();
				return returnValue;
			}
		}
	}
}
