package altair.simulator.pg;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import org.junit.Assert;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import altair.o2p.database.skeleton.asip.AsipSkeletonXml;
import altair.o2p.database.skeleton.asip.IAsip;
import altair.o2p.database.skeleton.machine.IMachineSkeleton;
import altair.o2p.database.skeleton.machine.MachineSkeletonXml;
import altair.o2p.database.skeleton.machine.addrspace.AddressSpaceSkeletonXml;
import altair.o2p.database.skeleton.machine.addrspace.IAddressSpaceSkeleton;
import altair.o2p.database.skeleton.machine.addrspace.IMipsAddr;
import altair.o2p.database.skeleton.machine.mem.IMemSkeleton;
import altair.o2p.database.skeleton.machine.mem.IMemSourceSkeleton;
import altair.o2p.database.skeleton.machine.mem.IMemViewSkeleton;
import altair.o2p.database.skeleton.machine.mem.IMemViewSkeletonProperty;
import altair.o2p.database.skeleton.machine.mem.MemSkeletonXml;
import altair.simulator.infrastructure.mem.IMem;
import altair.simulator.infrastructure.mem.IMem.MemTypeEnum;
import altair.simulator.infrastructure.mem.IMemView;
import altair.simulator.infrastructure.mem.IMemView.MemOffset;
import altair.simulator.infrastructure.mem.Mem;
import altair.simulator.infrastructure.mem.MemView;
import altair.simulator.infrastructure.reg.RegContainerForTests;
import altair.simulator.infrastructure.reg.real.IReg;
import altair.simulator.infrastructure.reg.real.Reg;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterPermissionEnum;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterSignEnum;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterTransferMethodEnum;
import altair.simulator.infrastructure.reg.utils.RegDefines.RegisterTypeEnum;
import altair.simulator.iss.asip.Asip;
import altair.simulator.iss.asip.AsipTestResources;
import altair.simulator.iss.asip.IAsipWrapper;
import altair.simulator.iss.asip.lsiu.instructionmemory.IInstructionMemory;
import altair.simulator.iss.asip.routineparser.GlobalDefines;
import altair.simulator.iss.asip.routineparser.InstructionMemoryFactory;
import altair.simulator.iss.fu.IFu;
import altair.simulator.pg.reflect.MethodInvocationLogger;
import altair.simulator.utils.logging.bus.EventBus;
import altair.simulator.utils.logging.monitor.FurandMonitor;
import altair.simulator.utils.logging.monitor.StatisticsMonitor;
import altair.simulator.utils.logging.monitor.memactions.MemActionsMonitor;
import altair.simulator.utils.logging.publisher.GeneralLogEventPublisher;
import altair.util.java6.identifier.IIdentifier;
import altair.util.java6.identifier.StringIdentifier;

import com.google.common.base.Joiner;
import com.google.common.collect.Lists;
import com.google.common.collect.Maps;

/**
 * Build a very simple ASIP and runs on it a very simple routine.
 * 
 * @author danielo
 *
 */
public class SimpleRoutineExecutionWithMemTest {

	private static final boolean VERBOSE = false;

	AsipTestResources resources = new AsipTestResources();
	IAsip skeleton;
	IMemSourceSkeleton memSkeletonXml;
	IMachineSkeleton machineDef;
	IAddressSpaceSkeleton addrSpDef;
	IAsipWrapper asip;
	IInstructionMemory instructionMem;

	@BeforeClass
	public static void init() {
		StatisticsMonitor.INSTANCE.resetErrorCount();
		StatisticsMonitor.INSTANCE.resetWarningCount();
		StatisticsMonitor.INSTANCE.resetFatalCount();
		FurandMonitor.INSTANCE.clearMonitorData();
		MemActionsMonitor.INSTANCE.clearAllMemActions();
		MemActionsMonitor.INSTANCE.clearAsipMemActions();
		MemActionsMonitor.INSTANCE.clearStaticMems();
		EventBus.INSTANCE.removeAllListeners();
	}

	@Before
	public void prepare() {
		if (VERBOSE) {
			EventBus.INSTANCE.addListener(FurandMonitor.INSTANCE);
			EventBus.INSTANCE.addListener(StatisticsMonitor.INSTANCE);
		}

		resources.withSkeleton("minimal_adding_asip.xml").withMem("mems_griffin_2.xml")
				.withRoutines("boot-code.acml", "routine3.acml").withMachine("machine_griffin3.xml")
				.withAddressSpace("address_space_griffin.xml");

		buildAsip();
		buildInstructionMemory();
	}

	@Test
	public void runAsip() throws IOException {
		asip.getAsipDispatcher().startAsipRun();
		while (asip.getAsipDispatcher().executeInstruction())
			; // executes boot code

		// move the pc to our main routine
		IReg externalPc = asip.getAsipPcu().findReg(StringIdentifier.identifier("EXTERNAL_PC"));
		int routineIndex = instructionMem.getRoutineIndex("routine3");
		externalPc.setUnsignedValue(routineIndex);

		asip.getAsipDispatcher().startAsipRun();
		while (asip.getAsipDispatcher().executeInstruction())
			;

		IFu alu = asip.getFu(StringIdentifier.identifier("ALU0"));
		IReg qReg = alu.findReg(StringIdentifier.identifier("Q"));
		Assert.assertEquals(7, qReg.getSignedValue());

		if (VERBOSE) {
			System.out.println(StatisticsMonitor.INSTANCE.getFatalCount());
			System.out.println(FurandMonitor.INSTANCE.getMonitorData());
		}
	}

	private void buildInstructionMemory() {
		Map<String, Integer> globalDefinesMap = Maps.newHashMap();
		globalDefinesMap.put("BBB_NUM1", 0x10);
		globalDefinesMap.put("BBB_NUM2", 0x20);
		globalDefinesMap.put("BBB_OUT", 0xFF);
		GlobalDefines globalDefines = new GlobalDefines(globalDefinesMap);
		instructionMem = InstructionMemoryFactory.INSTANCE.buildInstructionMemory(asip, globalDefines, skeleton,
				resources.getRoutines());
		asip.getLsiu().setInstructionMemory(instructionMem);
	}

	private void buildAsip() {
		skeleton = AsipSkeletonXml.create(resources.getSkeleton());
		memSkeletonXml = MemSkeletonXml.create(resources.getMem());
		memSkeletonXml = MethodInvocationLogger.getLoggingInstance(memSkeletonXml, IMemSourceSkeleton.class, true);
		machineDef = MachineSkeletonXml.create(resources.getMachine(), memSkeletonXml);
		addrSpDef = AddressSpaceSkeletonXml.create(resources.getAddressSpace());
		IMemView memView = buildAsipMemView(machineDef, addrSpDef, StringIdentifier.identifier("DDD"));
		memView = MethodInvocationLogger.getLoggingInstance(memView, IMemView.class, true);
		IMem mem = memView.getMem(0);
		IReg reg = new Reg(new RegContainerForTests("A"), "", 4, RegisterSignEnum.UNSIGNED);
		reg.setUnsignedValue(4);
		mem.sw(0x10, reg);
		reg.setUnsignedValue(3);
		mem.sw(0x20, reg);
		asip = new Asip("DDD", skeleton, machineDef, new WrappedMemView(memView));

	}

	public IMemView buildAsipMemView(IMachineSkeleton machineDefinition, IAddressSpaceSkeleton addressSpaceDefinition,
			IIdentifier asipID) {
		// build asip mem view based on definitions
		IMemView asipMemView;
		List<IMemViewSkeleton> asipMemViews = machineDefinition.getEngineMemViews(asipID);
		if (asipMemViews.size() != 1) {
			throw new IllegalStateException();
		} else {
			IMemViewSkeleton memViewDef = asipMemViews.iterator().next();
			List<MemOffset> memsOffsets = Lists.newArrayList();
			for (IMemViewSkeletonProperty memViewDefProp : memViewDef.getMemViewProperties()) {
				// build mem view memory and insert it into the asip mem view
				IMemSkeleton memSkel = memViewDefProp.getMemSkeleton();
				IMipsAddr memMipsAddr = addressSpaceDefinition.getMipsAddress(memSkel.getIdentifier());
				if (memMipsAddr == IMipsAddr.zeroMipsAddr) {
					GeneralLogEventPublisher.FATAL.publishEvent(Joiner.on("").join("Asip ", asipID,
							" has an associated memory ", memSkel.getIdentifier(),
							" which does not have a MIPS address\n"));
					throw new IllegalStateException();
				} else {
					MemTypeEnum memType = MemTypeEnum.values()[memSkel.getMemProperties().iterator().next()
							.getMemType().ordinal()];
					IMem newMem = new Mem(memSkel.getIdentifier().toString(), memMipsAddr.getBaseAddress(),
							memSkel.getSize(), memSkel.getMemCellWidth(), memType, RegisterTypeEnum.values()[memSkel
									.getMemCellType().ordinal()], RegisterTransferMethodEnum.values()[memSkel
									.getMemCellTransferMethod().ordinal()], RegisterPermissionEnum.values()[memSkel
									.getMemCellPermissionType().ordinal()]);
					memsOffsets.add(new MemOffset(newMem, memViewDefProp.getVirtualAddressOffset()));
				}
			}
			asipMemView = new MemView(memViewDef.getIdentifier().toString(), memsOffsets);
		}
		return asipMemView;
	}

}
